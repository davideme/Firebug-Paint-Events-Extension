/**
 * Copyright: 2009
 * Author: Kyle Scholz      http://kylescholz.com/
 * Author: Davide Mendolia
 */
FBL.ns(function() {with (FBL) {
    
  const SCREENSHOT_STAGE_ID = '__stage';
  const DOCUMENT_STAGE_ID = '__stage';
  const CANVAS_ID = '__canvas';
  const IMAGE_ID = '__image';
  const PREF_SCREENSHOTS = 'paintevents.collect_screenshots';
  const PREF_STOREEVENTS = 'paintevents.collect_storeevents';
  
  const FBPE_DEBUG_MODE = false;
    
  Firebug.Paint = extend(Firebug.Module, { 
    /* Indicates whether screenshots should be captured. */
    collectScreenshots: Firebug.getPref(Firebug.prefDomain, PREF_SCREENSHOTS),
    
    /* Indicates whether new events should be logged. */
    storeEvents: Firebug.getPref(Firebug.prefDomain, PREF_STOREEVENTS),
    
    /* Indicates whether events should be stored, due to user interaction. */
    storeEventsInteracting: true,
    
    initContext: function(context) {
      /* The collection of events for this context. */
      context.events = [];
      context.baseTime = new Date();
      this.logEvent({type: 'init', timestamp: context.baseTime}, context);
    
      // Watch MozAfterPaint and other events that will be useful for timing.
      var watch = ['MozAfterPaint', 'load', 'click'];
      for (var i = 0, eventType; eventType = watch[i++];) {
        context.window.addEventListener(eventType, (function(self, context) {
          return function(e) {
            if (Firebug.Paint.storeEvents &&
                Firebug.Paint.storeEventsInteracting) {
              if (e.type == 'MozAfterPaint') {
                // Decorate paint events for viewing.
                e.scrollX = context.window ? context.window.scrollX : 0;
                e.scrollY = context.window ? context.window.scrollY : 0;        
                if (Firebug.Paint.collectScreenshots) {
                  e.image = Firebug.Paint.getImage(context);        
                }
              }
              // Note: MozAfterPaint's 'timeStamp' is emtpy, so we add our own.
              // This will also be appended to other event types.
              e.timestamp = new Date();
              self.logEvent(e, context);
            }
          }
        })(this, context), false);
      }
    
      context.window.addEventListener('keypress', function(e) {
        if (e.ctrlKey && e.charCode == 122) Firebug.Paint.toggle();
      }, false);
    },
    
    toggle: function() {
      var storeEvents = !Firebug.getPref(Firebug.prefDomain, PREF_STOREEVENTS); 
      Firebug.setPref(Firebug.prefDomain, PREF_STOREEVENTS, storeEvents);
      Firebug.Paint.storeEvents = storeEvents;
      Firebug.Paint.syncPanelButtons();
    },
    
    toggleScreenshots: function() {  
      var screenshots = !Firebug.getPref(Firebug.prefDomain, PREF_SCREENSHOTS);
      Firebug.setPref(Firebug.prefDomain, PREF_SCREENSHOTS, screenshots);
      Firebug.Paint.collectScreenshots = screenshots;
      Firebug.Paint.syncPanelButtons();
    },
      
    syncPanelButtons: function() {
      Firebug.chrome.$('fbPaintToggle').checked = Firebug.Paint.storeEvents;
      Firebug.chrome.$('fbPaintScreenshotsToggle').checked =
      Firebug.Paint.collectScreenshots;
    },
    
    logEvent: function(e, context) {
      context.events.push(e);
      this.updateEventList(context.getPanel('Paint'));
    },
    
    clear: function(e) {
      Firebug.currentContext.events = [];
      Firebug.currentContext.baseTime = new Date();
      this.updateEventList(Firebug.currentContext.getPanel('Paint'));
    },
    
    showSidePanel: function(browser, panel) {
      try {
        if (panel && panel.name == 'PaintSide') {
          applyPaintPanelStyleSheet(panel);
          this.maybeCreateOverlayStage(panel);
          this.createScreenshotStage(panel);
        }
      } catch(e) {
        FBPE_DEBUG_MODE && Firebug.Console.log(e);
      }
    },
    
    /**
     * Conditionally create a stage to draw event clip rectangles on the window.
     * @param {Object} panel
     */
    maybeCreateOverlayStage: function(panel) {
      var doc = Firebug.currentContext.window.document;
      var stage = doc.getElementById(DOCUMENT_STAGE_ID + Firebug.currentContext.uid);
      if (!stage) {
        stage = doc.createElement('div');
        stage.style.position = 'absolute';
        stage.style.top = '0';
        stage.style.left = '0';
        stage.id = DOCUMENT_STAGE_ID + Firebug.currentContext.uid;
        doc.body.appendChild(stage);
      }
    },
    
    /**
     * Create a canvas element to construct screenshots.
     * @param {Object} panel
     */
    createCanvas: function(panel) {
      try {
        var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
        panel.panelNode.ownerDocument.body.appendChild(canvas);
        canvas.style.display = 'none';
        return canvas;
      } catch(e) {
        FBPE_DEBUG_MODE && Firebug.Console.log(e);
      }
    },
    
    /**
     * Grab a screenshot as a data URL.
     * @param {Object} context
     */
    getImage: function(context) {
      try {
        // Create a canvas for screenshots if we need one.
        if (!context.canvas) {
          context.canvas = Firebug.Paint.createCanvas(context.getPanel('Paint'));
        }
        var win = context.window;
        var width = win.document.body.offsetWidth;
        var height = win.document.body.offsetHeight;
  
        var canvas = context.canvas;
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawWindow(win, 0, 0, width, height, 'rgb(255,255,255)');
        return canvas.toDataURL();
      } catch(e) {
        FBPE_DEBUG_MODE && Firebug.Console.log(e);
      }
      return "";
    },
      
    /**
     * Create a stage for drawing clip rectangles and screenshots in the side
     * panel.
     * @param {Object} panel
     */
    createScreenshotStage: function(panel) {
      var doc = panel.panelNode.ownerDocument;
      panel.panelNode.innerHTML = '';
    
      var screenshotStage = doc.createElement('div');      
      screenshotStage.className = 'screenshotStage';
      screenshotStage.style.height = '100%';
      panel.panelNode.appendChild(screenshotStage);
    
      var innerScreenshotStage = doc.createElement('div');
      innerScreenshotStage.className = 'innerScreenshotStage';
      innerScreenshotStage.id = SCREENSHOT_STAGE_ID + Firebug.currentContext.uid;
      screenshotStage.appendChild(innerScreenshotStage);
    
      var img = Firebug.currentContext.window.document.createElement('img');
      img.className = 'screenshotImage';
      img.id = IMAGE_ID + Firebug.currentContext.uid;
      panel.panelNode.appendChild(img);
    },
    
    showPanel: function(browser, panel) { 
      if (panel && panel.name == 'Paint') {
        applyPaintPanelStyleSheet(panel);
        Firebug.Paint.syncPanelButtons(browser);
    
        // Don't capture paint events that are triggered by the extension. 
        panel.panelNode.ownerDocument.body.onmouseover = function() {
          Firebug.Paint.storeEventsInteracting = false;
        }
    
        panel.panelNode.ownerDocument.body.onmouseout = function() {
          Firebug.Paint.storeEventsInteracting = true;
          var doc = Firebug.currentContext.window.document;
          var stage = doc.getElementById(DOCUMENT_STAGE_ID + Firebug.currentContext.uid);
          if (stage) stage.innerHTML = '';
        }
        this.updateEventList(panel);
      }
    },

    /**
     * Handle an update to the event list and update the UI.
     * @param {Object} panel
     */  
    updateEventList: function(panel) {
      panel.panelNode.innerHTML = '';
      try {
      if (Firebug.currentContext.events.length) {
          var table = panel.tableTag.replace({}, panel.panelNode, panel);
          var tbody = table.firstChild;
          var lastRow = table.firstChild.firstChild;
    
          var row = panel.eventTag.insertRows(
            {events: Firebug.currentContext.events}, lastRow)[0];
          for (var i = 0, event; event = Firebug.currentContext.events[i++];) {
            row.repObject = event;
            event.row = row;
            row = row.nextSibling;
          }
        }
      } catch(e) {
        FBPE_DEBUG_MODE && Firebug.Console.log(e);
      }
    }
  }); 
    
  function PaintPanel() {};
  PaintPanel.prototype = domplate(Firebug.Panel, {
    /** @override */
    show: function(state) {
      if (this.showToolbarButtons) {
        this.showToolbarButtons('fbPaintButtons', true);
      }
    },
    
    /** @override */
    hide: function() {
      if (this.showToolbarButtons) {
        this.showToolbarButtons('fbPaintButtons', false);
      }
    },
    
    tableTag:
      TABLE({class: 'netTable',
             cellpadding: 2,
             cellspacing: 2,
             width: '100%'},
        TBODY(
          TR(
            TD({width:'90px'},
                '<b>Event</b>'),
            TD({width:'90px'},
                '<b>Time Offset</b>'),
            TD({})
          )
        )
      ),
    
    eventTag:
      FOR('event', '$events',
          TR({class: 'paintRow',
          onmouseover: '$hover',
          onclick: '$click'},
          TD({class: 'netCol',
              style: 'padding: 2px'},
              '$event.type'),
          TD({class: 'netCol',
              style: 'padding: 2px; text-align:right'},
              '$event|formatEvent'),
          TD({class: 'netCol'})
        )
      ),
    
    name: 'Paint', 
    title: 'Paints', 
    searchable: false, 
    editable: false,
    
    formatEvent: function(event) {
      return event.timestamp.getTime() - Firebug.currentContext.baseTime.getTime();
    },
    
    click: function(e) {
      var row = getAncestorByClass(e.target, 'paintRow');
      var event = row.repObject;
      Firebug.currentContext.baseTime = event.timestamp;
      Firebug.Paint.updateEventList(Firebug.currentContext.getPanel('Paint'));
    },
    
    hover: function(e) {
      var row = getAncestorByClass(e.target, 'paintRow');
      var event = row.repObject;
      if (event.type != 'MozAfterPaint') return;
      var sidePanel = Firebug.currentContext.getPanel('PaintSide', false);
    
      // For some reason, this width seems to be off by a bit.
      var screenshotWidth = sidePanel.panelNode.clientWidth - 16;

      // Draw paint event on document
      sidePanel.drawPaintEvent(
          event,
          Firebug.currentContext.window.document,
          Firebug.currentContext.window.document.getElementById(DOCUMENT_STAGE_ID +
          Firebug.currentContext.uid));

      // Draw paint event in screenshot pane
      sidePanel.drawPaintEvent(
          event,
          sidePanel.panelNode.ownerDocument,
          sidePanel.panelNode.ownerDocument.getElementById(
            SCREENSHOT_STAGE_ID + Firebug.currentContext.uid), true, screenshotWidth);
    
      if (event.image) {
        var img = sidePanel.panelNode.ownerDocument.getElementById(
            IMAGE_ID + Firebug.currentContext.uid);
        img.style.width = px(screenshotWidth);
        var scale = screenshotWidth / Firebug.currentContext.window.innerWidth;
        img.src = event.image;
      }
    }
  });
    
  function PaintSidePanel() {};
  PaintSidePanel.prototype = extend(Firebug.Panel, {
    name: 'PaintSide',
    title: 'Event Screenshot',
    parentPanel: 'Paint',
    order: 0,
    
    /**
     * Draw a clip rectangles for a pint event on the indcated stage.
     * @param {Object} event
     * @param {Object} doc
     * @param {Object} stage
     * @param {Boolean} screenshot
     * @param {Number} screenshotWidth
     */
    drawPaintEvent: function(event, doc, stage, screenshot, screenshotWidth) {
      stage.innerHTML = '';
      var cx = 1;
      if (screenshot) {
        cx = Firebug.currentContext.window.document.body.clientWidth / screenshotWidth;
      }

      for (var j=0, clientRect; clientRect = event.clientRects[j++];) {
        // Note: Sometimes clientRect.left has a large negative value (eg. -1351).
        // This will 'fix' them until I understand why.
        var clientRectLeft = clientRect.left;
        var clientRectWidth = clientRect.width; 
        if (clientRectLeft < 0) {
          clientRectWidth -= clientRectLeft;
          if (clientRectWidth < 0) continue;
          clientRectLeft = 0;
        }
    
        var rect = doc.createElement('div');
        rect.style.position = 'absolute';
    
        var top = parseInt((clientRect.top + event.scrollY) / cx) || 0;
        rect.style.top = px(top);
    
        var left = parseInt((clientRectLeft + event.scrollX) / cx) || 0;
        rect.style.left = px(left);
    
        var width = parseInt(clientRectWidth / cx) || 1;
        if (width < 1) width = 1;
        rect.style.width = px(width);
    
        var height = parseInt(clientRect.height / cx) || 1;
        if (height < 1) height = 1;
        rect.style.height = px(height);
    
        rect.style.backgroundColor = '#f00';
        rect.style.border = '1px solid #800';
        rect.style.MozOpacity = '0.5';
        stage.appendChild(rect);
      }
    }
  });
    
  Firebug.registerModule(Firebug.Paint); 
  Firebug.registerPanel(PaintPanel); 
  Firebug.registerPanel(PaintSidePanel);
    
  /**
   * Return the input value into as size string suitable for use in styles.
   * @param {Number} value
   */
  function px(value) {
    return parseInt(value) + 'px';
  }
    
  /**
   * Firebug panel stylesheets are explicitly linked to a central stylesheet.
   * Since that's not an option for this extension, apply the stylesheet
   * programmatically.
   * @param {Object} panel
   */
  function applyPaintPanelStyleSheet(panel) {
    var linkTag = panel.panelNode.ownerDocument.createElement('link');
    linkTag.rel = 'stylesheet';
    linkTag.href = 'chrome://firebugpaintevents/content/paint.css';
    panel.panelNode.ownerDocument.body.appendChild(linkTag);
  }
}});