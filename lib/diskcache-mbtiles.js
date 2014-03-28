var MBTiles =  require('mbtiles');
module.exports = DiskCacheMBTiles;
function DiskCacheMBTiles(diskcache) {
    this.source = {};
    this.writable = false;

    var me = this;

    if(diskcache.substr(-8) != '.mbtiles')
        diskcache += '.mbtiles';

    console.log('Create MBTiles cache at: '+ diskcache);

    me.source = new MBTiles(diskcache, function(err, obj) {
        if(err)
            throw err;
        obj.startWriting(function(err){
            if(err)
                throw err;
        });
        me.writable = true;
    });

}

DiskCacheMBTiles.prototype.getTile = function(id, callback) {

    var key = id.split(',');
    // hash function copied from mbtiles.js
    var coords = (1 << key[1]) * ((1 << key[1]) + key[2]) + ((1 << key[1]) - 1 - key[3]);

    // Get the file from the mbtiles
    // Look if the file is there, but not commited yet.
    if(this.source._mapCache && this.source._mapCache[coords] && this.source._mapCache[coords].tile_id &&
       this.source._tileCache && this.source._tileCache[this.source._mapCache[coords].tile_id]) {
        var data = this.source._tileCache[this.source._mapCache[coords].tile_id];
        var options ={
          'Content-Type': MBTiles.utils.getMimeType(data),
          'Last-Modified': new Date(this.source._stat.mtime).toUTCString(),
          'ETag': this.source._stat.size + '-' + Number(this.source._stat.mtime)
        };
        callback.apply(callback, [null, data, options]);
    }
    else {
        // Get the file from the mbtiles
        this.source.getTile(key[1], key[2], key[3], callback);
    }
};


DiskCacheMBTiles.prototype.putTile = function(id, result) {

    if(!this.writable)
        return;

    var key = id.split(',');
    this.source.putTile(key[1], key[2], key[3], result, 
                          function(err) {
                              if(err)
                                  throw err;
                          });
};
