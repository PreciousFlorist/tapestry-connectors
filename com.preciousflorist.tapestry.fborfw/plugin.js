/*
 * Unofficial For Better or For Worse Strip Fix connector for Tapestry.
 *
 * Source:
 *   https://www.fborfw.com/strip_fix/feed/
 *
 * The public RSS feed contains the comic image plus surrounding text.
 * This connector intentionally keeps only the strip image for display.
 */

function decodeXmlEntities(value) {
	if (!value) {
		return "";
	}

	var named = {
		amp: "&",
		quot: '"',
		apos: "'",
		lt: "<",
		gt: ">",
		nbsp: " ",
	};

	return String(value)
		.replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
			return String.fromCharCode(parseInt(hex, 16));
		})
		.replace(/&#([0-9]+);/g, function (_, dec) {
			return String.fromCharCode(parseInt(dec, 10));
		})
		.replace(/&([a-z]+);/gi, function (match, name) {
			var key = name.toLowerCase();
			return Object.prototype.hasOwnProperty.call(named, key) ? named[key] : match;
		});
}

function unwrapCdata(value) {
	if (!value) {
		return "";
	}

	var match = String(value).match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i);
	return match ? match[1] : String(value);
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractElement(block, tagName) {
	var tag = escapeRegExp(tagName);
	var expression = new RegExp("<" + tag + "\\b[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "i");
	var match = String(block || "").match(expression);
	return match ? match[1] : null;
}

function extractTagText(block, tagName) {
	var value = extractElement(block, tagName);
	if (value === null) {
		return "";
	}

	return decodeXmlEntities(unwrapCdata(value)).replace(/^\s+|\s+$/g, "");
}

function extractAttribute(attributes, name) {
	if (!attributes) {
		return null;
	}

	var expression = new RegExp("\\b" + escapeRegExp(name) + "\\s*=\\s*[\\\"']([^\\\"']+)[\\\"']", "i");
	var match = String(attributes).match(expression);
	return match ? decodeXmlEntities(match[1]) : null;
}

function absoluteFborfwUrl(value) {
	if (!value) {
		return null;
	}

	var url = decodeXmlEntities(String(value)).replace(/^\s+|\s+$/g, "");

	if (/^https?:\/\//i.test(url)) {
		return url;
	}

	if (/^\/\//.test(url)) {
		return "https:" + url;
	}

	if (url.charAt(0) === "/") {
		return "https://www.fborfw.com" + url;
	}

	return "https://www.fborfw.com/" + url.replace(/^\.\//, "");
}

function extractStripImage(html) {
	if (!html) {
		return null;
	}

	var imageExpression = /<img\b([^>]*)>/gi;
	var imageMatch;
	var fallback = null;

	while ((imageMatch = imageExpression.exec(html)) !== null) {
		var attributes = imageMatch[1];
		var src =
			extractAttribute(attributes, "src") ||
			extractAttribute(attributes, "data-src") ||
			extractAttribute(attributes, "data-lazy-src");

		var imageUrl = absoluteFborfwUrl(src);
		if (!imageUrl) {
			continue;
		}

		if (/\/strip_fix\/strips\/[^?#]+\.(?:gif|png|jpe?g|webp)(?:[?#].*)?$/i.test(imageUrl)) {
			return imageUrl;
		}

		if (
			!fallback &&
			/^https?:\/\/(?:www\.)?fborfw\.com\//i.test(imageUrl) &&
			/\.(?:gif|png|jpe?g|webp)(?:[?#].*)?$/i.test(imageUrl)
		) {
			fallback = imageUrl;
		}
	}

	var directMatch = String(html).match(
		/(?:https?:\/\/(?:www\.)?fborfw\.com)?\/strip_fix\/strips\/[^\"'&<>\s]+\.(?:gif|png|jpe?g|webp)/i,
	);

	if (directMatch) {
		return absoluteFborfwUrl(directMatch[0]);
	}

	return fallback;
}

function splitItems(xml) {
	var items = [];
	var expression = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
	var match;

	while ((match = expression.exec(xml)) !== null) {
		items.push(match[1]);
	}

	return items;
}

function parseItem(block, index) {
	var uri = extractTagText(block, "link");
	var dateText = extractTagText(block, "pubDate");

	if (!uri) {
		console.log("FBorFW item " + index + ": no post URL found");
		return null;
	}

	var date = new Date(dateText);
	if (!dateText || isNaN(date.getTime())) {
		console.log("FBorFW item " + index + ": no usable publication date found for " + uri);
		return null;
	}

	var content = extractElement(block, "content:encoded");
	if (content === null) {
		content = extractElement(block, "description");
	}

	content = unwrapCdata(content || "");

	var imageUrl = extractStripImage(content);
	if (!imageUrl) {
		console.log("FBorFW item " + index + ": no strip image found for " + uri);
		return null;
	}

	var item = Item.createWithUriDate(uri, date);
	var attachment = MediaAttachment.createWithUrl(imageUrl);

	attachment.text = "For Better or For Worse comic strip";
	item.attachments = [attachment];

	console.log("FBorFW item " + index + ": parsed " + imageUrl);
	return item;
}

function load() {
	var headers = {
		Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
		"Accept-Language": "en-US,en;q=0.9",
	};

	sendConditionalRequest(site, "GET", null, headers, false)
		.then(function (xml) {
			if (xml === null) {
				processResults(null);
				return;
			}

			var entries = splitItems(xml);
			console.log("FBorFW: found " + entries.length + " RSS items");

			if (entries.length === 0) {
				throw new Error("FBorFW returned an RSS document, but no <item> entries were found.");
			}

			var results = [];

			for (var i = 0; i < entries.length; i++) {
				var item = parseItem(entries[i], i);
				if (item) {
					results.push(item);
				}
			}

			if (results.length === 0) {
				throw new Error("FBorFW RSS items were found, but none contained a usable strip image.");
			}

			processResults(results);
		})
		.catch(function (error) {
			processError(error);
		});
}
