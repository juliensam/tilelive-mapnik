var MBTiles =  require('./diskcache-mbtiles');
var S3 =  require('./diskcache-s3');
module.exports = DiskCache;
function DiskCache(diskcache) {
    this.source = {};

    var me = this;

    var cachetype = 'mbtiles';
    var cacheinfo = diskcache.split(':');
    if(cacheinfo.length > 1) {
        cachetype = cacheinfo[0].toLowerCase();
        diskcache = cacheinfo[1];
    }
 
    switch(cachetype) {
      case 'mbtiles':
        me.source = new MBTiles(diskcache);
        break;
      case 's3':
        me.source = new S3(diskcache);
        break;
      default:
        throw new Error('Only MBTiles ans S3 disk cache are supported, '+cachetype+' specified.');
        break;
    }

}

DiskCache.prototype.getTile = function(id, callback) {
    this.source.getTile(id, callback);
};


DiskCache.prototype.putTile = function(id, result) {
    this.source.putTile(id, result);
};
