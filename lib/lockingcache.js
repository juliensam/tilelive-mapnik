var MBTiles = require('mbtiles');
module.exports = LockingCache;
function LockingCache(generate, timeout) {
    this.callbacks = {};
    this.timeouts = {};
    this.results = {};
    this._diskcache = false;

    var me = this;

    if(this.diskcache) {
        console.log('Create disk cache at: '+ this.diskcache)
        this._mbtiles = new MBTiles(this.diskcache, function(err, obj) {
            if(err)
                throw err;
            obj.startWriting(function(err){
                if(err)
                    throw err;
                me._diskcache = true;
            });
        });
    }

    // When there's no generator function, you
    this.generate = generate || function() {};

    // Timeout cached objects after 1 minute by default.
    this.timeout = timeout || 60000;
}

LockingCache.prototype.get = function(id, callback) {
    if (!this.callbacks[id]) this.callbacks[id] = [];
    this.callbacks[id].push(callback);

    if (this.results[id]) {
        this.trigger(id);
    } else {
        // It's possible to save the generated tiles in a mbtiles file
        if(this._mbtiles) {
            var cache = this;
            var key = id.split(',');
            // hash function copied from mbtiles.js
            var coords = (1 << key[1]) * ((1 << key[1]) + key[2]) + ((1 << key[1]) - 1 - key[3]);
            // Get the file from the mbtiles
            // If not there, generate it.
            var tileCallback = function(err, data, options) {
                if(err) {
                    var ids = cache.generate.call(cache, id);
                    if (!ids || ids.indexOf(id) < 0) {
                        cache.put(id, new Error("Generator didn't generate this item"));
                    } else ids.forEach(function(id) {
                            cache.results[id] = cache.results[id] || true;
                        }, cache);
                }
                else {
                    // not put, simulate a trigger.
                    process.nextTick(function() {
                            var tile = [null, data, options];
                            var callbacks = cache.callbacks[id] || [];
                            cache.del(id);
                            callbacks.forEach(function(callback) {
                                    callback.apply(callback, tile);
                                });
                        }.bind(cache));
                }
            };

            // Look if the file is there, but not commited yet.
            if(this._mbtiles._mapCache[coords] && this._mbtiles._mapCache[coords].tile_id &&
               this._mbtiles._tileCache[this._mbtiles._mapCache[coords].tile_id]) {
                var data = this._mbtiles._tileCache[this._mbtiles._mapCache[coords].tile_id];
                var options ={
                  'Content-Type': MBTiles.utils.getMimeType(data),
                  'Last-Modified': new Date(this._mbtiles._stat.mtime).toUTCString(),
                  'ETag': this._mbtiles._stat.size + '-' + Number(this._mbtiles._stat.mtime)
                };
                tileCallback.apply(tileCallback, [null, data, options]);
            }
            else {
                // Get the file from the mbtiles
                this._mbtiles.getTile(key[1], key[2], key[3], tileCallback);
            }
        }
        else {
            var ids = this.generate.call(this, id);
            if (!ids || ids.indexOf(id) < 0) {
                this.put(id, new Error("Generator didn't generate this item"));
            } else ids.forEach(function(id) {
                this.results[id] = this.results[id] || true;
            }, this);
        }
    }
};

LockingCache.prototype.del = function(id) {
    delete this.results[id];
    delete this.callbacks[id];
    if (this.timeouts[id]) {
        clearTimeout(this.timeouts[id]);
        delete this.timeouts[id];
    }
};

LockingCache.prototype.put = function(id) {
    this.timeouts[id] = setTimeout(this.del.bind(this, id), this.timeout);
    this.results[id] = Array.prototype.slice.call(arguments, 1);
    if (this.callbacks[id] && this.callbacks[id].length) {
        this.trigger(id);
    }
};

LockingCache.prototype.clear = function() {
    for (var id in this.timeouts) {
        this.del(id);
    }
};

LockingCache.prototype.trigger = function(id) {
    if (this.results[id] && this.results[id] !== true) {
        if(this._diskcache) {
            var key = id.split(',');
            this._mbtiles.putTile(key[1], key[2], key[3], this.results[id][1], 
                                  function(err) {
                                      if(err)
                                          throw err;
                                  });
        }
        process.nextTick(function() {
            var data = this.results[id];
            var callbacks = this.callbacks[id] || [];
            this.del(id);
            callbacks.forEach(function(callback) {
                callback.apply(callback, data);
            });
        }.bind(this));
    }
};
