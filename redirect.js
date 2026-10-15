(function() {
  console.log("[GMaps→Brave] Content script injected at:", document.readyState);

  function parseGoogleMaps(rawUrl) {
    console.log("[GMaps→Brave] Parsing URL:", rawUrl);
    
    try {
      var u = new URL(rawUrl.startsWith("http") ? rawUrl : "https://" + rawUrl);
      var path = decodeURIComponent(u.pathname);
      var blob = u.pathname + "&" + u.search.slice(1);
      var qs = u.searchParams;

      var lat = null, lng = null, zoom = null, query = "";

      var m3 = blob.match(/!3d(-?\d+(?:\.\d+))/);
      var m4 = blob.match(/!4d(-?\d+(?:\.\d+))/);
      if (m3 && m4) {
        if (lat === null) lat = parseFloat(m3[1]);
        if (lng === null) lng = parseFloat(m4[1]);
      }

      var mv = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z)?/);
      if (mv) {
        if (lat === null) lat = parseFloat(mv[1]);
        if (lng === null) lng = parseFloat(mv[2]);
        if (mv[3] && zoom === null) zoom = parseInt(parseFloat(mv[3]), 10);
      }

      var legacyKeys = ["ll", "sll", "center"];
      for (var i = 0; i < legacyKeys.length; i++) {
        var k = legacyKeys[i];
        if ((lat === null || lng === null) && qs.has(k)) {
          var mm = qs.get(k).match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
          if (mm) {
            if (lat === null) lat = parseFloat(mm[1]);
            if (lng === null) lng = parseFloat(mm[2]);
          }
        }
      }
      if (zoom === null && qs.has("z")) zoom = parseInt(parseFloat(qs.get("z")), 10);

      var m;
      if ((m = path.match(/\/maps\/place\/([^/@?]+)/))) {
        query = m[1].replace(/\+/g, " ");
      } else if ((m = path.match(/\/maps\/search\/([^/@?]+)/))) {
        query = m[1].replace(/\+/g, " ");
      } else if ((m = path.match(/\/maps\/dir\/([^/]+)\/([^/@?]+)/))) {
        query = m[1].replace(/\+/g, " ") + " to " + m[2].replace(/\+/g, " ");
      } else if (qs.has("q")) {
        query = qs.get("q");
      }

      console.log("[GMaps→Brave] Parsed: lat=" + lat + ", lng=" + lng + ", zoom=" + zoom + ", query='" + query + "'");

      if (lat === null || lng === null) {
        var result = query
          ? "https://search.brave.com/maps/search?q=" + encodeURIComponent(query)
          : null;
        console.log("[GMaps→Brave] Query-only mode, result:", result);
        return result;
      }

      var z = zoom !== null ? zoom : 13;
      var halfLng = (360 / Math.pow(2, z)) * 0.5;
      var halfLat = halfLng * Math.cos((lat * Math.PI) / 180);

      var minLat = parseFloat(lat) - parseFloat(halfLat);
      var maxLat = parseFloat(lat) + parseFloat(halfLat);
      var minLng = parseFloat(lng) - parseFloat(halfLng);
      var maxLng = parseFloat(lng) + parseFloat(halfLng);

      var bbox = [
        minLng.toFixed(6),
        minLat.toFixed(6),
        maxLng.toFixed(6),
        maxLat.toFixed(6)
      ].join(",");

      var result = "https://search.brave.com/maps/search?q=" + encodeURIComponent(query) + "&bbox=" + encodeURIComponent(bbox);
      console.log("[GMaps→Brave] Final Brave URL:", result);
      return result;
      
    } catch(e) {
      console.error("[GMaps→Brave] Parse error:", e);
      return null;
    }
  }

  // Main redirect logic
  var currentUrl = location.href;
  console.log("[GMaps→Brave] Current URL:", currentUrl);

  // Only redirect if we haven't already been redirected
  if (!currentUrl.includes("search.brave.com") && !sessionStorage.getItem("gmaps2brave_done")) {
    var braveUrl = parseGoogleMaps(currentUrl);
    
    if (braveUrl) {
      console.log("[GMaps→Brave] Redirecting to:", braveUrl);
      sessionStorage.setItem("gmaps2brave_done", "1");
      
      // Try multiple redirect methods
      setTimeout(function() {
        try {
          location.replace(braveUrl);
          console.log("[GMaps→Brave] Used location.replace()");
        } catch(e1) {
          try {
            location.href = braveUrl;
            console.log("[GMaps→Brave] Used location.href");
          } catch(e2) {
            console.error("[GMaps→Brave] Both redirect methods failed:", e1, e2);
          }
        }
      }, 100);
    } else {
      console.log("[GMaps→Brave] No Brave URL generated");
    }
  } else {
    console.log("[GMaps→Brave] Already on Brave Maps or previously redirected, skipping.");
  }

})();
