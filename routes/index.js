var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index.html', { title: 'Whack !' });
});

router.get('/post', function(req, res) {
  res.render('post.html', { title: 'Whack - New Snippet' });
});

router.get('/search',function(req, res) {
    req.whack.search_snippets(req.query.query, function(err,snips){
        res.render('search.html', { 
            title: req.query.query + ' - Whack!', 
            query: req.query.query, 
            results: snips,
            empty: snips.length === 0, 
        });
    });
});

module.exports = router;
