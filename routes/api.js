var mongojs = require('mongojs');
var express = require('express');
var escape =  require('escape-html');
var router = express.Router();

/* API 
 * - snip/get/_id  -> returns the stuff with id
 * - snip/query/?tags=...&id=...
 * - snip/create/?tags=...&text=...
 * - snip/remove/_id
 * - snip/edit/_id/?tags=...&text=...
 * - tags/list
 * - tags/ngrams
 * - tags/alias
 */

router.get('/snip/create/', function(req, res, next) {
    var snippet = {
        tags: req.query.tags,
        text: req.query.text,
    };
    req.whack.create_snippet(snippet,{},
        function(err,snippet){
            if(err){
                next(new Error());
            }else{
                res.send('<pre>'+escape(JSON.stringify(snippet,null,4))+'</pre>');
            }
        });
});

router.get('/snip/get/:id', function(req, res, next) {
    req.whack.get_snippet(req.params.id,
        function(err,snippet){
            if(err){
                next(new Error());
            }else{
                res.send(JSON.stringify(snippet,null,4));
            }
        });
});

router.get('/snip/search/:tags', function(req, res, next) {
    var tags = req.params.tags.split('-').join(' ');
    console.log(tags);
    req.whack.search_snippets(tags,
        function(err,snippets){
            if(err){
                next(new Error());
            }else{
                res.send(JSON.stringify(snippets));
            }
        });
});

router.get('/snip/all',function(req,res) {
    req.whack.get_all_snippets(
        function(err,snippets){
            if(err){
                next(err);
            }else{
                res.send(JSON.stringify(snippets,null,4));
            }
        });
});

router.get('/benchmark',function(req,res) {
    var letters = 'abcdefghijklmnopqrstuvw';

    function rand_int(int){
        return Math.floor(Math.random()*int);
    }
    
    function rand_tag(maxlen){
        var tag = '';
        var len = Math.max(rand_int(maxlen || 8),3);
        while (len--) {
            tag += letters[rand_int(letters.length)];
        }
        return tag;
    }


    /* ------------- SEARCH ---------------- */

    var tags = [];
    var tagc = 10000;
    
    console.log('BUILDING '+tagc+' TAGS...');
    for ( var i = 0; i < tagc; i++) {
        tags.push(rand_tag());
    }
    
    function rand_snippet(){
        var stags = [];
        var stagc = Math.max(rand_int(20),1);
        while (stagc--) {
            stags.push(tags[rand_int(tagc)]);
        }
        //var body = [];
        //var bodyc = rand_int(100);
        //while (bodyc--) {
        //    body.push(rand_tag());
        //}
        return {
            tags: stags.join(' '),
        //    text: body.join(' '),
        }
    }

    var snippetc = 500000;

    console.log('INSERTING '+snippetc+' SNIPPETS...');

    while( snippetc-- ){
        if (snippetc % 50000 === 0) {
            console.log(snippetc);
            req.whack.indexes_print_stats();
        }
        req.whack.create_snippet(rand_snippet())
    }
    console.log("DONE");
    // console.log(tags);
    // req.whack.index_print_stats();
    // req.whack.indexes_print();

    var queryc = 10000;

    function query_test(queryc, min_tagc, max_tagc){
        queryc = queryc || 10000;
        min_tagc = min_tagc || 1;
        max_tagc = max_tagc || 1;
        progress = Math.floor(queryc/10);

        console.log('DOING '+queryc+' QUERIES...');
        console.log('MIN_TAGC:',min_tagc);
        console.log('MAX_TAGC:',max_tagc);

        var minr = 10000000;
        var maxr = 0;
        var totr = 0;
        var mint = 10000000;
        var maxt = 0;
        var q = queryc;

        var tsart = (new Date()).getTime();

        while ( q-- ) {
            if (q % progress === 0) {
                console.log(Math.floor((queryc-q)/queryc*100)+'%');
            }
            var query = [];
            var queryl = min_tagc + rand_int(max_tagc);
            while ( queryl-- ) {
                query.push(tags[rand_int(tags.length)]);
            }
            var ta = (new Date()).getTime();
            var r = req.whack.search_tags2(query).length;
            var tb = (new Date()).getTime();

            minr = Math.min(minr,r);
            maxr = Math.max(maxr,r);

            mint = Math.min(mint,(tb-ta));
            maxt = Math.max(maxt,(tb-ta));
            totr += r;
        }
        var tend = (new Date()).getTime();
        console.log('DONE');
        console.log('MIN:',minr);
        console.log('MAX:',maxr);
        console.log('AVG:',totr/queryc);
        console.log('MINT:',mint);
        console.log('MAXT:',maxt);
        console.log('AVGT:',(tend-tsart)/queryc);
        console.log('TOTT:',(tend-tsart)/1000);
        console.log(' ');
    }
    
    query_test(5000, 1, 3);
    query_test(5000, 4, 6);
    query_test(5000, 6, 9);
    query_test(5000, 9, 12);

    res.send('DONE');
});

module.exports = router;
