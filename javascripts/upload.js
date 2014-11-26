// Upload constructor
function Upload(file, o, key) {
  function Upload() {
    var upload, id, parts, part, segs, chunk_segs, chunk_lens, pipes, blob, imageTypes;

    imageTypes = ["image/png", "image/jpg", "image/jpeg", "image/gif"];
    
    upload = this;
    
    this.key = key;
    this.file = file;
    this.name = file.name;
    this.size = file.size;
    this.content_type = file.type;
    this.Etags = [];
    this.inprogress = [];
    this.uploaded = 0;
    this.status = "";
    this.imageData = {};

    if (_.contains(imageTypes, this.content_type)) {
      var fr = new FileReader;
      var fileLoaded = function() {
        var img = new Image;
        var imageLoaded = function() {
          console.log("imageLoaded");
          console.log(this);
          this.imageData.width = img.width;
          this.imageData.height = img.height;
        }
        img.onload = imageLoaded.bind(this);
        img.src = fr.result;
      };
      fr.onload = fileLoaded.bind(this);
      fr.readAsDataURL(upload.file);
    }

    // Break the file into an appropriate amount of chunks
    // This needs to be optimized for various browsers types/versions
    if (this.size > 1000000000) { // size greater than 1gb
      num_segs = 100;
      pipes = 10;
    } else if (this.size > 500000000) { // greater than 500mb
      num_segs = 50;
      pipes = 5;
    } else if (this.size > 100000000) { // greater than 100 mb
      num_segs = 20;
      pipes = 5;
    } else if (this.size > 50000000) { // greater than 50 mb
      num_segs = 5;
      pipes = 2;
    } else if (this.size > 10000000) { // greater than 10 mb
      num_segs = 2;
      pipes = 2;
    } else { // greater than 5 mb (S3 does not allow multipart uploads < 5 mb)
      num_segs = 1;
      pipes = 1;
    }  

    chunk_segs = _.range(num_segs + 1);
    chunk_lens = _.map(chunk_segs, function(seg) {
      return Math.round(seg * (file.size/num_segs));
    });

    if (upload.sliceBlob == "Unsupported") {
      this.parts = [new UploadPart(file, 0, upload)];
    } else {
      this.parts = _.map(chunk_lens, function(len, i) {
        blob = upload.sliceBlob(file, len, chunk_lens[i+1]);
        return new UploadPart(blob, i+1, upload);
      });
      this.parts.pop(); // Remove the empty blob at the end of the array
    }

    // init function will initiate the multipart upload, sign all the parts, and 
    // start uploading some parts in parallel
    this.init = function() {
      upload.initiateMultipart(upload, function(obj) {
        var id = upload.id = obj.id
          , upload_id = upload.upload_id = obj.upload_id
          , object_name = upload.object_name = obj.key // uuid generated by the server, different from name
          , parts = upload.parts;

        upload.signPartRequests(id, object_name, upload_id, parts, function(response) {
          _.each(parts, function(part, key) {
            part.date = response[key].date;
            part.auth = response[key].authorization;

            // Notify handler that an xhr request has been opened
            upload.handler.beginUpload(pipes, upload);
          });
        });
      }); 
    } 
  };
  // Inherit the properties and prototype methods of the passed in S3MP instance object
  Upload.prototype = o;
  return new Upload(); 
}
