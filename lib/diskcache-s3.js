var fs = require('fs');
//var Buffer = require('buffer');
AWS = require('aws-sdk');

module.exports = DiskCacheS3;
function DiskCacheS3(diskcache) {
    this.client = {};
    this.project = 'default'
    this.writable = false;
    this.bucket = '';

    var me = this;

    var configpath = diskcache.split('/');
    me.project = configpath.pop();
    configfile = configpath.join('/');

    // Attempts to read AWS_KEY, AWS_SECRET from *.s3cfg.
    var cfg = {};
    try {
        var s3cfg = fs.readFileSync(configfile, 'utf8');
        cfg.AWS_KEY = s3cfg.match(/access_key = (.*)/)[1];
        cfg.AWS_SECRET = s3cfg.match(/secret_key = (.*)/)[1];
        cfg.AWS_TOKEN = (s3cfg.match(/sts_token = (.*)/)||[])[1];
        cfg.BUCKET = (s3cfg.match(/bucket = (.*)/)||[])[1];
        cfg.REGION = (s3cfg.match(/region = (.*)/)||[])[1];
    } catch(err) {console.log(err.message)};

    console.log('Create S3 cache at: //'+ cfg.BUCKET+'/'+this.project+' key:'+cfg.AWS_KEY+' secret:'+'****'/*cfg.AWS_SECRET*/);

    me.bucket = cfg.BUCKET;    

    var awsConfig = new AWS.Config({accessKeyId: cfg.AWS_KEY, secretAccessKey: cfg.AWS_SECRET});
    
    if(cfg.REGION)
       awsConfig.update({region: cfg.REGION});

    me.client = new AWS.S3(awsConfig);

    me.writable = true;
}

DiskCacheS3.prototype.getFileName = function(id) {

    var key = id.split(',');
    var ext = key[0];
    var z = key[1];
    var x = key[2];
    var y = key[3];
    var prefix = (x%16).toString(16) + (y%16).toString(16);
    var path = prefix+'/'+this.project+'/'+z+'/'+x+'/'+y+'.'+ext;

    return path;
};

DiskCacheS3.prototype.getExtension = function(id) {

    var ext = '';

    if(id.indexOf('jpeg') == 0) {
        ext = 'jpg';
    } else if(id.indexOf('png') == 0) {
        ext = 'png'
    } else if(id.indexOf('gif') == 0) {
        ext = 'gif'
    } else {
        var key = id.split(',');
        ext = key[0];
    }

    return ext;
};

DiskCacheS3.prototype.getContentType = function(id) {

    var ext = this.getExtension(id);
    var contentType = 'image/'+ext;

    if(ext == 'jpg')
        contentType = 'image/jpeg'

    return contentType;
};


DiskCacheS3.prototype.getTile = function(id, callback) {
      var request = this.client.getObject({Key: this.getFileName(id), Bucket: this.bucket},
         function(err, res) {
            if(err) {
                callback(err);
		return
            }
	    
            // Need to use a binary buffer instead of string
            var data = false;

            var options ={
              'Content-Type': res.ContentType,
              'Last-Modified': res.LastModified,
              'ETag': res.ETag
            };

            data = res.Body;
	    callback.apply(callback, [null, data, options]);
        });
};


DiskCacheS3.prototype.putTile = function(id, result) {

    if(!this.writable)
        return;

    var headers = {
        'Content-Length': result.length
      , 'Content-Type': this.getContentType(id)
    };
    var name = this.getFileName(id);
    var buffer = new Buffer(result);

    this.client.putObject({Key: name, Body: buffer, Bucket: this.bucket},
        function(err, res){
            // An error occured, simply do nothing.
            if(err) {
                console.log(err);
            }
        });

};
