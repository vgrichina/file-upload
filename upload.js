var http = require("http");
var url = require("url");
var multipart = require("multipart");
var sys = require("sys");
var events = require("events");
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

// Server would listen on port 8000
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
 * Write chunk of uploaded file
 */
function write_chunk(request, fileDescriptor, chunk, isLast, closePromise) {
    // Pause receiving request data (until current chunk is written)
    request.pause();
    // Write chunk to file
    sys.debug("Writing chunk");
    posix.write(fileDescriptor, chunk).addCallback(function() {
        sys.debug("Wrote chunk");
        // Resume receiving request data
        request.resume();
        // Close file if completed
        if (isLast) {
            sys.debug("Closing file");
            posix.close(fileDescriptor).addCallback(function() {
                sys.debug("Closed file");
                
                // Emit file close promise
                closePromise.emitSuccess();
            });
        }
    });
}

/*
 * Handle file upload
 */
function upload_file(req, res) {
    // Request body is binary
    req.setBodyEncoding("binary");

    // Handle request as multipart
    var stream = new multipart.Stream(req);
    
    // Create promise that will be used to emit event on file close
    var closePromise = new events.Promise();

    // Add handler for a request part received
    stream.addListener("part", function(part) {
        sys.debug("Received part, name = " + part.name + ", filename = " + part.filename);
        
        var openPromise = null;

        // Add handler for a request part body chunk received
        part.addListener("body", function(chunk) {
            // Calculate upload progress
            var progress = (stream.bytesReceived / stream.bytesTotal * 100).toFixed(2);
            var mb = (stream.bytesTotal / 1024 / 1024).toFixed(1);
     
            sys.debug("Uploading " + mb + "mb (" + progress + "%)");

            // Ask to open/create file (if not asked before)
            if (openPromise == null) {
                sys.debug("Opening file");
                openPromise = posix.open("./uploads/" + part.filename, process.O_CREAT | process.O_WRONLY, 0600);
            }

            // Add callback to execute after file is opened
            // If file is already open it is executed immediately
            openPromise.addCallback(function(fileDescriptor) {
                // Write chunk to file
                write_chunk(req, fileDescriptor, chunk, 
                    (stream.bytesReceived == stream.bytesTotal), closePromise);
            });
        });
    });

    // Add handler for the request being completed
    stream.addListener("complete", function() {
        sys.debug("Request complete");

        // Wait until file is closed
        closePromise.addCallback(function() {
            // Render response
            res.sendHeader(200, {"Content-Type": "text/plain"});
            res.sendBody("Thanks for playing!");
            res.finish();
        
            sys.puts("\n=> Done");
        });
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
