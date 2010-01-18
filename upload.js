var http = require('http');
var url = require('url');
var multipart = require('multipart');
var sys = require('sys');

var server = http.createServer(function(req, res) {
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
server.listen(8000);

function display_form(req, res) {
  res.sendHeader(200, {'Content-Type': 'text/html'});
  res.sendBody(
    '<form action="/upload" method="post" enctype="multipart/form-data">'+
    '<input type="file" name="upload-file">'+
    '<input type="submit" value="Upload">'+
    '</form>'
  );
  res.finish();
}

function upload_file(req, res) {
  req.setBodyEncoding('binary');

  var stream = new multipart.Stream(req);
  stream.addListener('part', function(part) {
    part.addListener('body', function(chunk) {
      var progress = (stream.bytesReceived / stream.bytesTotal * 100).toFixed(2);
      var mb = (stream.bytesTotal / 1024 / 1024).toFixed(1);

      sys.print("Uploading "+mb+"mb ("+progress+"%)\015");

      // chunk could be appended to a file if the uploaded file needs to be saved
    });
  });
  stream.addListener('complete', function() {
    res.sendHeader(200, {'Content-Type': 'text/plain'});
    res.sendBody('Thanks for playing!');
    res.finish();
    sys.puts("\n=> Done");
  });
}

function show_404(req, res) {
  res.sendHeader(404, {'Content-Type': 'text/plain'});
  res.sendBody('You r doing it rong!');
  res.finish();
}
