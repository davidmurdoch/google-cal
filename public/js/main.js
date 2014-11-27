$(function(){

  var signedIn = false,
    people, calendar,
    calendars = $(".calendars"),
    miniCalendar = $(".miniCalendar"),
    miniCalendarContent = miniCalendar.children(".miniCalendar-content"),
    topHeader = $(".top-header"),
    menuLink = $(".menu-link"),
    toasty = $("#toasty"),
    monthNameEl = $(".month-name"),
    requests = {
      "_count": 0,
      "spinner": $( ".loading-spinner" ),
      "start": function() {
        requests._count++;
        requests.spinner.attr( "active", true );
      },
      "end": function() {
        if ( requests._count-- ) {
          requests.spinner.removeAttr( "active" );
        }
      },
    },
    dayNames = ["Sun","Mon","Tues","Wed","Thur","Fri","Sat"],
    monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

  // set up polymer stuff
  $("google-signin").on("google-signin-success", function(){
    if(signedIn){return;}
    signedIn = true;
    $("body").removeClass("loading");

    populateCalendarListAndEvents();
    populateName();
  }).on("google-signed-out", function(){
    signedIn = false;
    $("body").addClass("loading");
  });

  $("#calendar").on("google-api-load", function(){
    calendar = this.api;

    populateCalendarListAndEvents();
  });

  $("#people").on("google-api-load", function(){
    people = this.api.people;
    populateName();
  });


  // set up event listeners

  $(".refresh-link").click(function(){
    var cal = miniCalendar.data("calendar");
    if ( cal ) {
      populateEventList( cal );
    }
  });

  miniCalendarContent.delegate(".day-label.with-event", "click", function(){
    // close the calendar
    monthNameEl.click();
    var timestamp = $(this).data("timestamp");
    $(".time_" + timestamp).each(function(){
       this.scrollIntoView();
    });
  });

  calendars.delegate("a", "click", function(){
    var cal = $(this).data("calendar");
    populateEventList(cal);
    menuLink.click();
  });

  monthNameEl.click(function(){
    var cal = miniCalendar;
    if ( !topHeader.is(".open-calendar") ) {
      cal.height("auto");
      var h = cal.height();
      cal.height(0);
      cal.height(h);
    }
    else{
      cal.height(0);
    }

    topHeader.toggleClass("open-calendar");
  });

  menuLink.click(function(){
    topHeader.toggleClass("open-menu");
  });

  $(".menu").click(function( e ) {
    if ( e.target === this ) {
      menuLink.click();
    }
  });

  var dialog = $(".add-event-dialog");
  $(".add-button").on("click", function(e){
  	e.preventDefault();

  	dialog.removeAttr("opened").attr("opened", true);
  });

  $("#add-event-cancel").click(function(){
    dialog.removeAttr("opened");
  });
  $("#prev-month-button").click(function(){
    var cal = miniCalendar.data("calendar");
    var curStart = miniCalendar.data("date");
    curStart.setMonth(curStart.getMonth()-1);
    miniCalendar.height("auto");
    populateEventList(cal, curStart);
  });
  $("#next-month-button").click(function(){
    var cal = miniCalendar.data("calendar");
    var curStart = miniCalendar.data("date");
    curStart.setMonth(curStart.getMonth()+1);
    miniCalendar.height("auto");
    populateEventList(cal, curStart);
  });

  $("#add-event-save").click(function(){
    var cal = miniCalendar.data("calendar");
    var event = {
        "calendarId": cal.id,
        "summary": null,
        "start": {"date":null},
        "end": {"date":null}
      };
    dialog.find("input").each(function(){
      var name = this.name;
      var val = _.trim(this.value);
      switch(name){
        case "title":
          event.summary = val;
          break;
        case "date":
          if ( val ) {
            val = new Date(val.replace("/", "-"));
            // make sure it is a valid date
            if ( !isNaN(val.getTime()) ) {
              event.start.date = event.end.date = val.getUTCFullYear() + "-"  + (val.getUTCMonth()+1) + "-" + val.getUTCDate();
            }
          }
          break;
      }
    });
    if ( event.summary && event.end.date && event.start.date ) {
      try{
        requests.start();
        var request = calendar.events.insert(event);
        request.then(function success(){
          requests.end();
          dialog.removeAttr("opened");
          showToast("New event saved successfully");

          populateEventList(cal);
        }, function err(res){
          requests.end();
          if ( res.error && res.error.message ) {
            showToast("New event not added: " + res.error.message);
          }
          else{
            showToast("An unknown error occured. Please refresh and try again.");
          }
        });
      }
      catch(error){
        showToast(error);
      }
    }
    else{
      showToast("New event not added: event title and date are required.");
    }
  });


  // helper methods

  function showToast(text){
    toasty.attr("text", text).removeAttr("opened").attr("opened", true);
  }

  /**
   * Gets the name of the logged in user and writes it to the UI
   */
  function populateName() {
    if ( people && signedIn ) {
      var request = people.get({
          'userId': 'me'
      });
      requests.start();
      request.execute(function(resp) {
        requests.end();
        $(".displayName").text(resp.displayName);
      });
    }
  }

  function populateCalendarListAndEvents() {
    if ( calendar && signedIn ) {
      var request = calendar.calendarList.list({"key": ""});
      requests.start();
      request.execute(function(resp) {
        requests.end();
        calendars.empty();
        for(var calendarList = resp.items, i = 0, l = calendarList.length; i < l; i++){
          var cal = calendarList[i];
          // todo, make this a polymer element
          var li = $("<li></li>");
          var a = $("<a href=#></a>").text(cal.summary);
          li.append(a);
          a.data("calendar", cal);
          calendars.append(li);

          if ( cal.primary ) {
            var now = new Date();
            var start = new Date(now.getFullYear(), now.getMonth(), 1);
            var end = new Date(now.getFullYear(), now.getMonth()+1, 0);
            populateEventList(cal, start, end);
          }
        }
      });
    }
  }

  function populateEventList( cal, start, end ) {
    // if start isn't defined, get the date from the miniCalendar, if that isn't defined, get today's date
    var now = new Date();
    start || (start = miniCalendar.data("date") || (new Date(now.getFullYear(), now.getMonth(), 1)));
    // if end isn't defined, use the last day of the start month
    end || (end = new Date(start.getFullYear(), start.getMonth()+1, 0));

    getEvents(cal, start, end, function(resp){
      miniCalendar.data("calendar", cal);
      miniCalendar.data("date", start);

      var events = resp.items;

      _.each(events, function(event){
        // normlize the start dates
        // JavaScript interprets dates oddly, "-" signifies the date at UTC/GMT, "/" signifies a local date
        if ( event.start.date ) {
          event.start.date = event.start.date.replace("-","/");
        }
        if ( event.end.date ) {
          event.end.date = event.end.date.replace("-","/");
        }
      });

      populateCalendar(events, start);

      var template = '<li>\
        <div class="day time_{{timestamp}}">\
          <div class="day-label">\
            <div class="day-label-number">{{day}}</div>\
            <div class="day-label-day">{{dayOfWeek}}</div>\
          </div>\
          <ul class="events">\
            {{events}}\
          </ul>\
        </div>\
      </li>';
      var html = "";

      var sorted = _.sortBy(events, function(event){
        // parse the date so we can sort it
        return event.startDateTime = new Date(event.start.dateTime || event.start.date);
      });
      var groups = _.groupBy(sorted, function(event){
        return event.startDateTime.setHours(0,0,0,0);
      });

      _.each(groups, function(group, timestamp){

        var day = new Date(+timestamp); // timestamp is a string, we need a date
        var eventsHtml = "";
        for ( var i = 0, l = group.length; i < l; i++ ) {
          var event = group[i];
          var details = extractEventDetails(event);

          eventsHtml += "<li class=event><div class=summary>" + _.escape(event.summary) + "</div><div class=''>" + _.escape(details) + "</div></li>";
        }
        html += template.replace("{{timestamp}}", timestamp).replace("{{events}}", eventsHtml).replace("{{day}}", day.getUTCDate()).replace("{{dayOfWeek}}", dayNames[day.getUTCDay()]);
      });
      $(".events-container").html(html);
    });
  }

  function extractEventDetails(event){
    var details = "";
    // add some detailed information, if appropriate
    if ( event.start.dateTime ) {

      var endDetails = "", endIsPM = false;
      if (event.end.dateTime){
        var endDateTime = new Date(event.end.dateTime),
            endHours =  endDateTime.getHours();

        endIsPM = endHours >= 12;

        var endTime = endHours > 12 ? endHours - 12 : endHours,
            endMinutes = endDateTime.getMinutes().toString();

        endTime += ":" +  (endMinutes.length === 1 ? "0" : "") + endMinutes,
        endDetails = " — " + endTime + (endIsPM ? " PM" : " AM");
      }

      var startDateTime = new Date(event.start.dateTime),
          startHours =  startDateTime.getHours(),
          startIsPM = startHours >= 12,
          startTime = startHours > 12 ? startHours - 12 : startHours,
          startMinutes = startDateTime.getMinutes().toString(),
	      // if start and end use the same part of teh day, omit it from the start portion, otherwise, include it.
	      startPartOfDay = (startIsPM === endIsPM ? "" : (startIsPM ? " PM" : " AM"));

      startTime += ":" +  (startMinutes.length === 1 ? "0" : "") + startMinutes + startPartOfDay;
      details = startTime + endDetails;
    }
    return details;
  }

  function populateCalendar( events, start ){
    var today = new Date();
    var todayTimestamp = today.setHours(0,0,0,0);
    var year = start.getFullYear();
    var month = start.getMonth();
    var firstOfMonth = new Date(year, month, 1);
    var lastOfMonth = new Date(year, month+1, 0, 23, 59, 59);
    var numDaysInMonth = lastOfMonth.getDate();
    var dayOfWeek = firstOfMonth.getDay();
    var html = "";
    var monthName = monthNames[month];
    if( year !== today.getFullYear()){
      monthName = monthName.substring(0, 3) + " " + year;
    }
    $(".month-name-text").text(monthName);
    var i = 0;

    for(i = 0; i < 7; i++){
      html += "<div class=day>" + dayNames[i][0] + "</div>";
    }
    // populate the days that aren't in this month with blank spots
    for(i = 0; i < dayOfWeek; i++){
      html += "<div class=day></div>";
    }
    // now populate the days of this month, highlighting days that have events
    for ( i = 1; i <= numDaysInMonth; i++ ) {
      var hasEvent = _.any(events, function(el){
        // TODO: DRY this up.
        if (el.start ) {
          var startDate = new Date(el.start.dateTime || el.start.date);
          if( startDate >= firstOfMonth && startDate <= lastOfMonth && startDate.getDate() === i){
            return true;
          }
        }
        if ( el.end ) {
          var endDate = new Date(el.end.dateTime || Date.parse(el.end.date)-1); // subtract 1 millisecond from the end.date because it is always returns the first millisecond of the next day
          if( endDate >= firstOfMonth && endDate <= lastOfMonth && endDate.getDate() === i){
            return true;
          }
        }
        return false;
      });
      var thisDate = new Date(firstOfMonth.setDate(i));
      var isToday = thisDate.setHours(0,0,0,0) === todayTimestamp;
      var button = hasEvent ? "<paper-button data-timestamp=" + thisDate.getTime() + " class=\"day-label with-event\">" + i + "</paper-button>" : "<paper-button class=day-label>" + i + "</div>";
      html += "<div class=\"day" + (isToday ? " highlight" : "") + "\">" + button + "</div>";
    }
    miniCalendarContent.html(html);
  }

  function getEvents(cal, start, end, callback){
    var request = calendar.events.list({
      "calendarId": cal.id,
      "singleEvents": true,
      "timeMin": (start.getFullYear() + "-" + (start.getMonth()+1) + "-" + start.getDate() + "T00:00:00Z"),
      "timeMax": (end.getFullYear() + "-" + (end.getMonth()+1) + "-" + end.getDate() + "T00:00:00Z")
    });
    requests.start();
    request.execute(function(){
      requests.end();
      callback.apply(this, arguments);
    });
  }

});