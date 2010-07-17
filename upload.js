var http = require("http");
var url = require("url");
var multipart = require("multipart");
var sys = require("sys");
var fs = require("fs");

var server = http.createServer(function(req, res) {
    // Simple path-based request dispatcher
    switch (url.parse(req.url).pathname) {
        case '/':
            display_form(req, res);
            break;
        case '/upload':
            upload_file(req, res);
            break;
        default:
            show_404(req, res);
            break;
    }
});

// Server would listen on port 8000
server.listen(8000);

/*
 * Display upload form
 */
function display_form(req, res) {
    res.sendHeader(200, {"Content-Type": "text/html"});
    res.write(
        '<form action="/upload" method="post" enctype="multipart/form-data">'+
        '<input type="file" name="upload-file">'+
        '<input type="submit" value="Upload">'+
        '</form>'
    );
    res.close();
}

/*
 * Create multipart parser to parse given request
 */
function parse_multipart(req) {
    var parser = multipart.parser();

    // Make parser use parsed request headers
    parser.headers = req.headers;

    // Add listeners to request, transfering data to parser

    req.addListener("data", function(chunk) {
        parser.write(chunk);
    });

    req.addListener("end", function() {
        parser.close();
    });

    return parser;
}

/*
 * Handle file upload
 */
function upload_file(req, res) {
    // Request body is binary
    req.setBodyEncoding("binary");

    // Handle request as multipart
    var stream = parse_multipart(req);

    var fileName = null;
    var fileStream = null;

    // Set handler for a request part received
    stream.onPartBegin = function(part) {
        sys.debug("Started part, name = " + part.name + ", filename = " + part.filename);

        // Construct file name
        fileName = "./uploads/" + stream.part.filename;

        // Construct stream used to write to file
        fileStream = fs.createWriteStream(fileName);

        // Add error handler
        fileStream.addListener("error", function(err) {
            sys.debug("Got error while writing to file '" + fileName + "': ", err);
        });

        // Add drain (all queued data written) handler to resume receiving request data
        fileStream.addListener("drain", function() {
            req.resume();
        });
    };

    // Set handler for a request part body chunk received
    stream.onData = function(chunk) {
        // Pause receiving request data (until current chunk is written)
        req.pause();

        // Write chunk to file
        // Note that it is important to write in binary mode
        // Otherwise UTF-8 characters are interpreted
        sys.debug("Writing chunk");
        fileStream.write(chunk, "binary");
    };

    // Set handler for request completed
    stream.onEnd = function() {
        // As this is after request completed, all writes should have been queued by now
        // So following callback will be executed after all the data is written out
        fileStream.addListener("drain", function() {
            // Close file stream
            fileStream.end();
            // Handle request completion, as all chunks were already written
            upload_complete(res);
        });
    };
}

function upload_complete(res) {
    sys.debug("Request complete");

    // Render response
    res.sendHeader(200, {"Content-Type": "text/plain"});
    res.write("Thanks for playing!");
    res.end();

    sys.puts("\n=> Done");
}

/*
 * Handles page not found error
 */
function show_404(req, res) {
    res.sendHeader(404, {"Content-Type": "text/plain"});
    res.write("You r doing it rong!");
    res.end();
}
