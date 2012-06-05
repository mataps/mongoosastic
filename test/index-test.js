var mongoose  = require('mongoose')
  , elastical = require('elastical')
  , should    = require('should')
  , config    = require('./config')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.ObjectId
  , mongoosastic = require('../lib/mongoosastic')
  , esClient  = new(require('elastical').Client)


// -- simplest indexing... index all fields
var TweetSchema = new Schema({
    user: String
  , post_date: Date
  , message: String
});


TweetSchema.plugin(mongoosastic, {
    index:'tweets'
  , type: 'tweet'
})
var Tweet = mongoose.model('Tweet', TweetSchema);

// -- Only index specific field
var TalkSchema = new Schema({
    speaker: String
  , title: {type:String, es_indexed:true}
  , abstract: {type:String, es_indexed:true}
  , bio: String
});
TalkSchema.plugin(mongoosastic, {
    index:'tweets' // keep it simple for now. in the real world don't do this
  , type: 'tweet'
})

var Talk = mongoose.model("Talk", TalkSchema);

// -- alright let's test this shiznit!
describe('indexing', function(){
  before(function(done){
    mongoose.connect(config.mongoUrl, function(){
      Tweet.remove(function(){
        deleteIndexIfExists('tweets', done)
      });
    });
  });

  after(function(done){
    Tweet.remove(function(){
      mongoose.disconnect();
      done();
    });
  });

  describe('Default plugin', function(){
    before(function(done){
      var tweet = new Tweet({
          user: 'jamescarr'
        , message: "I like Riak better"
        , post_date: new Date()
      });
      tweet.save(function(){
        tweet.on('es-indexed', function(err, res){
          setTimeout(done, 1100)
        });
      });
    });
    it('should be able to execute a simple query', function(done){
      Tweet.search({query:'Riak'}, function(err, results) {
        results.total.should.eql(1)
        results.hits[0].message.should.eql('I like Riak better')
        done()
      });
    });
    it('should be able to execute a simple query', function(done){
      Tweet.search({query:'jamescarr'}, function(err, results) {
        results.total.should.eql(1)
        results.hits[0].message.should.eql('I like Riak better')
        done()
      });
    });
    it('should report errors', function(done){
      Tweet.search({queriez:'jamescarr'}, function(err, results) {
        err.message.should.match(/SearchPhaseExecutionException/);
        should.not.exist(results)
        done()
      });
    });
  });

  describe('Subset of Fields', function(){
    before(function(done){
      var talk = new Talk({
          speaker: 'James Carr'
        , title: "Node.js Rocks"
        , abstract: "I told you node.js was cool. Listen to me!"
        , bio: 'One awesome dude.'
      });
      talk.save(function(){
        talk.on('es-indexed', function(err, res){
          setTimeout(done, 1000)
        });
      });
    });

    it('should only return indexed fields', function(done){
      Talk.search({query:'cool'}, function(err, res) {
        res.total.should.eql(1)

        var talk = res.hits[0]
        talk.should.have.property('title')
        talk.should.have.property('abstract')
        talk.should.not.have.property('speaker')
        talk.should.not.have.property('bio')
        done()
      });
    });
    /*
    it('should hydrate returned documents if desired', function(done){
      Talk.search({query:'cool'}, {hydrate:true}, function(err, res) {
        res.total.should.eql(1)

        var talk = res.hits[0]
        talk.should.have.property('title')
        talk.should.have.property('abstract')
        talk.should.have.property('speaker')
        talk.should.have.property('bio')
        done()
      });
    });
   */
  });
});


function deleteIndexIfExists(index, cb){
  esClient.indexExists(index, function(err, exists){
    if(exists){
      esClient.deleteIndex(index, cb);
    }else{
      cb()
    }
  });
}
