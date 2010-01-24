var http = require("http");
var url = require("url");
var multipart = require("multipart");
var sys = require("sys");
var posix = require("posix");

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

// Server would listen on port 800
server.listen(8000);


/*
 * Display upload form
 */
function display_form(req, res) {
    res.sendHeader(200, {"Content-Type": "text/html"});
    res.sendBody(
        '<form action="/upload" method="post" enctype="multipart/form-data">'+
        '<input type="file" name="upload-file">'+
        '<input type="submit" value="Upload">'+
        '</form>'
    );
    res.finish();
}

/*
 * Handle file upload
 */
function write_chunk(fileDescriptor, chunk, isLast) {
    // Write chunk to file
    sys.debug("Writing chunk");
    posix.write(fileDescriptor, chunk).addCallback(function() {
        // Close file if completed
        if (isLast) {
            sys.debug("Closing file");
            posix.close(fileDescriptor).addCallback(function() {
                sys.debug("Closed file");
            });
        }
    });
}

function upload_file(req, res) {
    req.setBodyEncoding("binary");

    // Handle request as multipart
    var stream = new multipart.Stream(req);
    
    // Add handler for a request part received
    stream.addListener("part", function(part) {
        sys.debug("Received part, name = " + part.name + ", filename = " + part.filename);
        
        var fileDescriptor = null;
        var openPromise = null;

        // Add handler for a request part body chunk received
        part.addListener("body", function(chunk) {
            var progress = (stream.bytesReceived / stream.bytesTotal * 100).toFixed(2);
            var mb = (stream.bytesTotal / 1024 / 1024).toFixed(1);
     
            sys.debug("Uploading " + mb + "mb (" + progress + "%)");

            // Wait for file to be opened if needed
            if (fileDescriptor == null) {
                sys.debug("Waiting for file");
                // Ask to open/create file (if not asked before)
                if (openPromise == null) {
                    sys.debug("Opening file");
                    openPromise = posix.open("./uploads/" + part.filename, process.O_CREAT | process.O_WRONLY, 0600);
                }
                openPromise.addCallback(function(fd) {
                    sys.debug("File opened");
                    // Write chunk to file
                    fileDescriptor = fd;
                    write_chunk(fileDescriptor, chunk, (stream.bytesReceived == stream.bytesTotal));
                });
            } else {
                // Write chunk to file
                write_chunk(fileDescriptor, chunk, (stream.bytesReceived == stream.bytesTotal));
            }
        });

        part.addListener("complete", function() {
            sys.debug("Part complete"); 
        });
    });

    // Add handler for the request being completed
    stream.addListener("complete", function() {
        sys.debug("Request complete");

        // TODO: Wait until all chunks are written
        res.sendHeader(200, {"Content-Type": "text/plain"});
        res.sendBody("Thanks for playing!");
        res.finish();

        sys.puts("\n=> Done");
    });
}

/*
 * Handles page not found error
 */
function show_404(req, res) {
    res.sendHeader(404, {"Content-Type": "text/plain"});
    res.sendBody("You r doing it rong!");
    res.finish();
}
