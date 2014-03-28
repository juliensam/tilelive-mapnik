var fs = require('fs');
//var Buffer = require('buffer');
var knox = require('knox');

module.exports = DiskCacheS3;
function DiskCacheS3(diskcache) {
    this.client = {};
    this.project = 'default'
    this.writable = false;

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
    } catch(err) {console.log(err.message)};

    console.log('Create S3 cache at: //'+ cfg.BUCKET+'/'+this.project+' key:'+cfg.AWS_KEY+' secret:'+'****'/*cfg.AWS_SECRET*/);

    me.client = knox.createClient({
          key: cfg.AWS_KEY
        , secret: cfg.AWS_SECRET
        , bucket: cfg.BUCKET
    });

    me.writable = true;
}

DiskCacheS3.prototype.getFileName = function(id) {

    var key = id.split(',');
    var ext = key[0];
    var z = key[1];
    var x = key[2];
    var y = key[3];
    var prefix = (x%16).toString(16) + (y%16).toString(16);
    var path = '/'+prefix+'/'+this.project+'/'+z+'/'+x+'/'+y+'.'+ext;

    return path;
};

DiskCacheS3.prototype.getTile = function(id, callback) {

    var request = this.client.get(this.getFileName(id));
    request.on('response', function(res){

        if(res.statusCode != 200) {
            callback(new Error('Tile does not exist'));
        }

        // Need to use a binary buffer instead of string
        var statusCode = res.statusCode;
        var data = false;
        var options ={
          'Content-Type': res.headers['content-type'],
          'Last-Modified': res.headers['last-modified'],
          'ETag': res.headers['etag']
        };

        res.on('data', function(chunk){
            if(data === false)
                data = chunk;
            else
                data = Buffer.concat([data, chunk]);
        });
        res.on('end', function(res) {
            if(statusCode == 200)
                callback.apply(callback, [null, data, options]);
        });
    }).end();
};


DiskCacheS3.prototype.putTile = function(id, result) {

    if(!this.writable)
        return;

    var req = this.client.put(this.getFileName(id), {
        'Content-Length': result.length
      , 'Content-Type': 'image/'+id.split(',')[0]
    });
    req.on('response', function(res){
        if (200 == res.statusCode) {
            //console.log('saved to %s', req.url);
        }
    });
    req.end(result);
};
