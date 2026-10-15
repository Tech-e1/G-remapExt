// Parse function MUST be defined BEFORE onClicked listener

function parseGoogleMaps(rawUrl) {
  try {
    var u = new URL(rawUrl.startsWith("http") ? rawUrl : "https://" + rawUrl);
    var path = decodeURIComponent(u.pathname);
    var blob = u.pathname + "&" + u.search.slice(1);
    var qs = u.searchParams;

    var lat = null, lng = null, zoom = null, query = "";

    // (1) precise pin: !3dLAT!4dLNG
    var m3 = blob.match(/!3d(-?\d+(?:\.\d+))/);
    var m4 = blob.match(/!4d(-?\d+(?:\.\d+))/);
    if (m3 && m4) {
      if (lat === null) lat = parseFloat(m3[1]);
      if (lng === null) lng = parseFloat(m4[1]);
    }

    // (2) viewport: /@lat,lng[,zoomz]
    var mv = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z)?/);
    if (mv) {
      if (lat === null) lat = parseFloat(mv[1]);
      if (lng === null) lng = parseFloat(mv[2]);
      if (mv[3] && zoom === null) zoom = parseInt(parseFloat(mv[3]), 10);
    }

    // (3) legacy params
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

    // (4) query term - CHECK BOTH q AND query PARAMS
    var m;
    if ((m = path.match(/\/maps\/place\/([^/@?]+)/))) {
      query = m[1].replace(/\+/g, " ");
    } else if ((m = path.match(/\/maps\/search\/([^/@?]+)/))) {
      query = m[1].replace(/\+/g, " ");
    } else if ((m = path.match(/\/maps\/dir\/([^/]+)\/([^/@?]+)/))) {
      query = m[1].replace(/\+/g, " ") + " to " + m[2].replace(/\+/g, " ");
    } else if (qs.has("q")) {
      query = qs.get("q");
    } else if (qs.has("query")) {
      query = qs.get("query");
    }

    console.log("[GMaps→Brave BG] After extraction: lat=" + lat + ", lng=" + lng + ", query='" + query + "'");

    // Query-only mode (no coordinates, but we have a search term)
    if (lat === null || lng === null) {
      if (query) {
        var result = "https://search.brave.com/maps/search?q=" + encodeURIComponent(query);
        console.log("[GMaps→Brave BG] Query-only fallback, result:", result);
        return result;
      }
      console.log("[GMaps→Brave BG] No coordinates and no query");
      return null;
    }

    // (5) zoom → bbox
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
    console.log("[GMaps→Brave BG] Full URL with coords, result:", result);
    return result;
    
  } catch(e) {
    console.error("[GMaps→Brave BG] Parse error:", e);
    return null;
  }
}

chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    id: "open-in-brave-maps",
    title: "Open in Brave Maps",
    contexts: ["link"]
  });
  console.log("[GMaps→Brave BG] Context menu created");
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  console.log("[GMaps→Brave BG] Context menu clicked:", info.linkUrl);

  if (info.menuItemId !== "open-in-brave-maps" || !info.linkUrl) {
    console.log("[GMaps→Brave BG] Ignored click - wrong item or no URL");
    return;
  }

  var braveUrl = parseGoogleMaps(info.linkUrl);
  console.log("[GMaps→Brave BG] Parsed URL:", braveUrl);

  if (braveUrl === null) {
    console.log("[GMaps→Brave BG] Failed to parse URL");
    return;
  }

  console.log("[GMaps→Brave BG] Opening new tab with Brave URL");
  chrome.tabs.create({ url: braveUrl }, function(createdTab) {
    if (chrome.runtime.lastError) {
      console.error("[GMaps→Brave BG] Tab creation failed:", chrome.runtime.lastError.message);
    } else {
      console.log("[GMaps→Brave BG] Tab created successfully:", createdTab.id);
    }
  });
});
