var sp = getSpotifyApi();
var models = sp.require('$api/models');
var views = sp.require('$api/views');

var playlist = null;
//TODO: Use local storage for list if possible.
var recentPlaylists = [];

$(document).ready(function () {
  $('textarea').autosize();
  $('#playlist-recent-container').hide();
  $('#submit-button').attr('disabled', 'disabled');

  $('#playlist-name').bind('textchange', function(event, previousText){
    if ($(this).val().length) {
      $('#submit-button').removeAttr('disabled');
    }
    else {
      $('#submit-button').attr('disabled', 'disabled');
    }
  });

  $('#search').submit(function() {
    if (playlist == null) {
      if ($('#playlist-name').val().length) {
        playlist = new models.Playlist($('#playlist-name').val());
          recentPlaylists.push(playlist);
          $('#playlist-recent').append($('<option></option>')
            .attr('value', recentPlaylists.length - 1)
            .text(playlist.data.name ));
          $('#playlist-name').val('');
          $('#playlist-recent').val(recentPlaylists.length - 1);
          $('#playlist-recent-container').fadeIn('fast');
          $('#playlist-name-container').fadeOut('fast');
      }
    }
    var timeLimit = parseInt($('#timelimit').val());
    var minAmount = parseInt($('#minamount').val());

    var queries = $('#query-multiple').val().split("\n");
    for (i in queries) {
      if (queries[i].length > 0) {
        getSongList(queries[i], timeLimit, minAmount);
      }
    }
    return false;
  });

  $('#playlist-recent').change(function(){
    if ($(this).val() > -1) {
      playlist = recentPlaylists[$(this).val()];
      var list = new views.List(playlist);
      $('#results').html(list.node);
      $('#playlist-name-container').fadeOut('fast');
      $('#submit-button').removeAttr('disabled');
    }
    else {
      $('#playlist-name-container').fadeIn('fast');
      playlist = null;
      $('#results').empty();
      if ($('#playlist-name').val().length) {
        $('#submit-button').removeAttr('disabled');
      }
      else {
        $('#submit-button').attr('disabled', 'disabled');
      }
    }
  });
});

function useSongs(songlist, query) {
  console.log(songlist);
  for (var i in songlist) {
    findAndAdd(query, songlist[i], playlist);
  }
}

function sldate2date(sldate){
  var a = sldate.match(/([0-9]{2})-([0-9]{2})-([0-9]{4})/);
  return new Date(a[3], a[2]-1, a[1]);
}

function findAndAdd(artist, track, playlist) {
  var options = {
    searchAlbums: false,
    searchArtists: false,
    searchPlaylists: false,
    pageSize: 10
  };

  var search = new models.Search('artist:"' + artist.replace("'",'') + '"' + ' track:"' + track.replace("'",'') + '"', options);
  search.observe(models.EVENT.CHANGE, function() {
    console.log(search);
    var results = search.tracks;
    search.tracks.sort(function(a, b) {
      if (a.data.album.year < b.data.album.year) {
        return -1;
      }
      if (a.data.album.year > b.data.album.year) {
        return 1;
      }
      return 0;
    });

    for(var i in results) {
      if (results[i].data.artists[0].name.score(artist, 0.5) > 0.25 && results[i].data.name.score(track, 0.5) > 0.25) {
        console.log([results[i],results[i].data.name, results[i].data.artists[0].name,results[i].data.album.name,results[i].data.album.year]);
        playlist.add(results[i].data.uri);
        break;
      }
    }
    var list = new views.List(playlist);
    $('#results').html(list.node);
  });
  search.appendNext();    
}

function getSongList(query, timeLimit, minAmount) {
  query = jQuery.trim(query).toLowerCase();
  var artist = null;
  var songs = {};
  var position = 0;
  var songlist = [];
  var earliestDate = new Date(new Date().getTime() - new Date(timeLimit*1000));
  jQuery.getJSON('http://api.setlist.fm/rest/0.1/search/artists.json?artistName=' + encodeURIComponent(query), function(data) {
    if (data.artists.artist instanceof Array) {
      for (var i in data.artists.artist) {
        data.artists.artist[i].score = data.artists.artist[i]['@name'].score(query, 0.5);
      }
      data.artists.artist.sort(function(a, b) {
        if (a.score < b.score) {
          return -1;
        }
        if (a.score > b.score) {
          return 1;
        }
        return 0;
      });
      artist = data.artists.artist.pop();
    }
    else {
      artist = data.artists.artist;
    }
    jQuery.getJSON('http://api.setlist.fm/rest/0.1/artist/' + artist['@mbid'] + '/setlists.json', function(data) {
      // One setlist.
      if (!(data.setlists.setlist instanceof Array)) {
        data.setlists.setlist = [data.setlists.setlist];
      }
      for (var j in data.setlists.setlist) {
        var setlist = data.setlists.setlist[j];
        var eventDate = sldate2date(setlist['@eventDate']);
        if (timeLimit > -1 && eventDate.getTime() < earliestDate.getTime() && j >= minAmount) {
          continue;
        }
        // Multiple sets.
        if (!(setlist.sets.set instanceof Array)) {
          // No sets.
          if (!(setlist.sets.set instanceof Object)) {
            continue;
          }
          // One set.
          else {
            setlist.sets.set = [setlist.sets.set];
          }
        }
        for(var k in setlist.sets.set) {
          var set = setlist.sets.set[k];
          // One song.
          if (!(set.song instanceof Array)) {
            set.song = [set.song];
          }
          for(var l in set.song) {
            var song = set.song[l];
            var name = song['@name'];
            if (!(name in songs)) {
              songs[name] = position++;
            }
          }
        }
      }
      for (var j in songs) {
        songlist[songs[j]] = j;
      }
      useSongs(songlist, query);
    });
  });
}

