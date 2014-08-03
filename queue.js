
(function(modula){
    
    function Queue(){
        this.content = [];
    }

    modula.Queue = Queue;
    
    Queue.prototype = {
        add: function(score,value){
            this.content.push({score:score, value:value});
            this._bubbleUp(this.content.length - 1);
        },
        pop: function(){
            var result = this.content[0];
            var end    = this.content.pop();
            if(this.content.length > 0){
                this.content[0] = end;
                this._sinkDown(0);
            }
            if(result){
                return result.value;
            }else{
                return null;
            }
        },
        length: function size(){
            return this.content.length;
        },
        _bubbleUp: function _bubbleUp(n){
            var element = this.content[n];
            while( n > 0 ){
                var parentN = Math.floor((n + 1) / 2) - 1;
                var parent  = this.content[ parentN ];
                if(element.score >= parent.score){
                    break;
                }
                this.content[parentN] = element;
                this.content[n] = parent;
                n = parentN;
            }
        },
        _sinkDown: function _sinkDown(n){
            var element = this.content[n];
            var length  = this.content.length;
            while( true ){
                var child2N = ( n+1 ) * 2;
                var child1N = child2N - 1;
                var swap = null;

                if(child1N < length ){ 
                    var child1 = this.content[child1N];
                    if(child1.score < element.score){
                        swap = child1N;
                    }
                }

                if(child2N < length) { 
                    var child2 = this.content[child2N];
                    if( child2.score < ( swap === null ? element.score: child1.score) ){
                        swap = child2N;
                    }
                }

                if(swap === null){
                    break;
                }
                this.content[n] = this.content[swap];
                this.content[swap] = element;
                n = swap;
            }
        },

    };

    function SQueue() {
        this.elems = [];
    }

    // sorted queue, pops the element with the highest score.
    SQueue.prototype = {
        push: function(score,value) {
            score = -score;
            if ( this.elems.length === 0 || this.elems[this.elems.length -1].score <= score) {
                this.elems.push({ score:score, value:value });
            } else {
                for (var i = 0; i < this.elems.length; i++) {
                    if (this.elems[i].score >= score) {
                        this.elems.splice(i,0,{ score:score, value:value});
                        break;
                    }
                }
            }
        },
        length: function() {
            return this.elems.length;
        },
        pop: function() {
            var pop = this.elems.pop();
            if (pop) {
                return pop.value;
            } else {
                return null;
            }
        },
    };
})(typeof module === 'undefined' ? ( this['modula'] || (this['modula'] = {})) : module.exports );
