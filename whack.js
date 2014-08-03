var mongojs      = require('mongojs');
var hash         = require('./libs/murmur3.js').hash;
var Queue        = require('./queue.js').Queue;

function Index(name,entries){
    this.name = name;
    this.index = entries || [];
}
Index.prototype = {
    length: function(){
        return this.index.length;
    },
    first: function(){
        return this.index[0];
    },
    last: function(){
        return this.index[this.index.length - 1];
    },
    insert: function(score,taglist,uid){
        var entry = { 'score':score, 'uid':uid, 'taglist':taglist };
        var index = this.index;
        var cur   = 0;

        if ( !index[0] ){
            index.push(entry);
        } else if ( score <= index[0].score ) {
            if ( score === index[0].score ) {
                index[0] = entry;
            } else {
                index.unshift(entry);
            }
        } else if ( score >= index[index.length -1].score ) {
            cur = index.length - 1;
            if ( score === index[cur].score ) {
                index[cur] = entry;
            }else{
                index.push(entry);
            }
        } else {    // FIXME DUAL ENTRY
            var min = 0;
            var max = index.length - 1;
            var mscore = index[max].score;
            var c = max;
            var cscore = mscore;


            while (max - min > 1) {
                c = Math.ceil(min + (max-min)/2);
                cscore = index[c].score;
                if (cscore === score) {
                    max = c;
                    min = c-1;
                    mscore = cscore;
                } else if (cscore < score) {
                    min = c;
                } else {
                    max = c;
                    mscore = cscore;
                }
            }
            if (mscore === score){
                index[max] = entry;
            } else {
                index.splice(max,0,entry);
            }
        }
    },
    print: function(){
        console.log('INDEX: ',this.name);
        var ind = this.index;
        if (ind.length === 0) {
            console.log('    EMPTY');
        } else {
            for (var i = 0; i < ind.length; i++) {
                console.log('    '+ind[i].score+'  '+ind[i].taglist.join(' '));
            }
        }
    },
};

function Whack(db){
    this.db = mongojs('mongodb://localhost:27017/whack',['indexes','snippets']);
    this.tagtree = {
        snippets: [],
        subtags:  [],
    };
    this.indexes  = {};
    this.snippets = {};
    this.scores = {
        '"' : 10,   // word in the body 
        '@' : 0.5,  // organisation tag
        '#' : 1.2,  // stream tag 
        ':' : 0.9,  // meta tag
        '.' : 0.1,  // private tag
    };
    this.hash_seed = 12345;
};

Whack.prototype = {
    load_db: function(result){
        var self = this;

        function done(err){
            if(result){ result(err); }
        }
        function load_snippets(then){
            self.db.snippets.find({},function(err,snippets){
                if (err) {
                    done(err);
                } else {
                    console.log('LOADING '+snippets.length+' SNIPPETS FROM DB...');
                    for (var i = 0; i < snippets.length; i++){
                        var snippet = snippets[i];
                        if ( snippet.tags && snippet.text) { 
                            self.create_snippet({
                                tags: snippet.tags,
                                text: snippet.text,
                            },{ nodb:true });
                        }
                    }
                    console.log('DONE');
                    then();
                }
            });
        }

        load_snippets(done);

        return this;
    },
    uid: function(){
        if(!this._uid){
            this._uid = 1;
        }
        return ''+(this._uid++);
    },
    hash: function(str) {
        var h = hash(str,this.hash_seed);
        return h / 4294967296.0;
    },
    indexes_print: function(){
        for (var index in this.indexes) {
            console.log(index);
            this.indexes[index].print();
        }
    },
    indexes_print_stats: function(){
        var count = 0;
        var total = 0;
        var max   = 0;
        var min   = 100000000000;
        
        for ( var index in this.indexes ) {
            var len = this.indexes[index].length();
            count += 1;
            total += len;
            if ( len > max ) {
                max = len;
            }
            if ( len < min ) {
                min = len;
            }
        }
        console.log('INDEX STATS');
        console.log(' -> COUNT    :',count);
        console.log(' -> AVG.SIZE :',total/count);
        console.log(' -> MIN.SIZE :',min);
        console.log(' -> MAX.SIZE :',max);
    },
    tags_normalize: function(tagstr){
        var tags = tagstr.trim().split(' ');
        var ntags = [];
        var tagset = {};
        
        for (var i = 0; i < tags.length; i++) {
            var tag = tags[i];
            tag = tag.toLowerCase();
            if (!tagset[tag]) {
                ntags.push(tag);
                tagset[tag] = true;
            }
        }

        ntags.sort(function(a,b){ return a.localeCompare(b); });
        return ntags;
    },
    tags_score: function(taglist) {
        var score = this.hash(taglist.join(' ')) * 0.05;
        for (var i = 0; i < taglist.length; i++) {
            var tag = taglist[i];
            score += (this.scores[tag[0]] || 1);
        }
        return score;
    },
    indexes_create: function(taglist) {
        var indexes = [];

        taglist = taglist.slice(0);

        for (var i = 0; i < taglist.length; i++) {
            var tag =  taglist[i];
            if (this.scores[tag[0]]) {
                taglist.push(tag.substring(1));
            }
            if (!this.indexes[tag]) {
                this.indexes[tag] = new Index(tag);
            }
            indexes.push(this.indexes[tag]);
        }
        return indexes;
    },

    insert_tags: function(taglist, uid) {
        var score   = this.tags_score(taglist);
        var indexes = this.indexes_create(taglist);

        for (var i = 0; i < indexes.length; i++) {
            indexes[i].insert(score,taglist,uid);
        }
    },
    /* this search is 10x slower than search_tags ! */
    search_tags3: function(taglist, options) {
        options = options || {};

        var indexes  = [];
        var minscore = options.minscore || this.tags_score(taglist);
        var count    = options.count || 10;
        var queue    = new Queue();
        var inter    = {};
        var tagc     = taglist.length;
        var matches  = [];

        for (var i = 0; i < tagc; i++) {
            if (!this.indexes[taglist[i]]){
                return [];
            } else {
                var index = this.indexes[taglist[i]].index;
                if (!index.length || index[ index.length - 1 ].score < minscore) {
                    return [];
                } else { 
                    indexes.push(index);
                }
            }
        }
        
        for (var i = 0; i < indexes.length; i++) {
            var index = indexes[i];
            for (var j = 0; j < index.length; j++) {
                var score = index[j].score;
                if ( score > minscore ){
                    if ( !inter[score] ){
                        inter[score] = {
                            count: 0,
                            entry: index[j],
                        };
                    }
                    inter[score].count++;
                }
            }
        }

        for ( score in inter ) {
            var inters = inter[score];
            if (inters.count >= tagc){
                matches.push(inters.entry.uid);
            }
        }

        matches.sort(function(a,b){
            return b.score - a.score;
        });

        return matches;
    },
    search_tags: function(taglist, options) {

        options = options || {};

        var indexes  = [];
        var minscore = options.minscore || this.tags_score(taglist);
        var count    = options.count || 10;
        var queue    = new Queue();
        var tagc     = taglist.length;

        for (var i = 0; i < tagc; i++) {
            if (!this.indexes[taglist[i]]){
                return [];
            } else {
                indexes.push(this.indexes[taglist[i]]);
            }
        }

        for (var i = 0; i < tagc; i++) {
            var index = indexes[i].index;
            if (!index.length || index[ index.length - 1 ].score < minscore) {
                return [];
            } else {
                queue.add(index[0].score, { 
                    pos: 0, 
                    index: index,
                });
            }
        }

        var matches = [];
        var cmatch  = 0;

        while ( matches.length < count && queue.length() > 0 ) {
            var idx     = queue.pop();
            var pos     = idx.pos;
            var index   = idx.index;
            var abandon = false;

            while ( index[pos].score < minscore ){
                pos++;
                if ( pos >= index.length) {
                    return matches;
                }
            }

            if ( index[pos].score === minscore ){
                cmatch++;
                if ( cmatch === tagc ) {
                    cmatch = 0;
                    matches.push(index[pos].uid);
                }
                pos++;
            } else {
                minscore = index[pos].score;
                cmatch = 0;
            }
            
            if ( pos < index.length ) {
                idx.score = index[pos].score;
                idx.pos = pos;
                queue.add(idx.score, idx);
            }
        }

        return matches;
    },

    create_snippet: function(snippet,options,result){
        options = options || {};
        var uid     = this.uid();
        var taglist = this.tags_normalize(snippet.tags); 

        snippet._uid = uid;
        snippet.tags = taglist.join(' ');

        this.snippets[uid] = snippet;
        if( taglist.length ){
            this.insert_tags(taglist,uid);
        }

        function done(err,snippet){
            if (result){ result(err,snippet); }
        }

        if (!options.nodb) {
            this.db.snippets.insert(snippet,function(err){
                done(err,snippet);
            });
        } else {
            done(snippet);
        }
    },
    get_snippet:  function(uid,result){
        if(result){
            result(false,this.snippets[uid]);
        }
    },
    search_snippets: function(tags, result){
        tags = this.tags_normalize(tags);
        var uids = this.search_tags(tags);
        var snippets = [];
        for(var i = 0; i < uids.length; i++){
            snippets.push(this.snippets[uids[i]]);
        }
        if(result){
            result(false,snippets);
        }
    },
    get_all_snippets: function(result){
        var snippets = [];
        for(var uid in this.snippets){
            snippets.push(this.snippets[uid]);
        }
        if(result){
            result(false,snippets);
        }
        //this.db.snippets.find(result);
    },
};

module.exports = {
    'Whack': Whack,
};
