/*
 * Unofficial Harvard Business Review connector for Tapestry.
 *
 * Source:
 *   https://hbr.org/the-latest
 *
 * This connector reads HBR's public "The Latest" page and creates
 * timeline items containing the article title, author(s), publication
 * date, summary, and original HBR URL.
 *
 * It does not authenticate with HBR, retrieve subscriber-only article
 * bodies, or contain any user credentials or personal information.
 */

function decodeHtmlEntities(value) {
	if (!value) {
		return "";
	}

	var named = {
		nbsp: " ",
		amp: "&",
		quot: '"',
		apos: "'",
		lt: "<",
		gt: ">",
		ndash: "-",
		mdash: "-",
		lsquo: "'",
		rsquo: "'",
		ldquo: '"',
		rdquo: '"',
		hellip: "...",
	};

	return value
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

function htmlToText(value) {
	if (!value) {
		return "";
	}

	return decodeHtmlEntities(value.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " "))
		.replace(/\s+/g, " ")
		.trim();
}

function escapeHtml(value) {
	return String(value || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function absoluteHbrUrl(href) {
	if (!href) {
		return null;
	}

	href = decodeHtmlEntities(href).trim();

	if (/^https?:\/\//i.test(href)) {
		return href;
	}

	if (href.charAt(0) === "/") {
		return "https://hbr.org" + href;
	}

	return "https://hbr.org/" + href;
}

function extractAttribute(attributes, name) {
	if (!attributes) {
		return null;
	}

	var expression = new RegExp("\\b" + name + "\\s*=\\s*[\"']([^\"']+)[\"']", "i");

	var match = attributes.match(expression);

	return match ? decodeHtmlEntities(match[1]) : null;
}

function parseHbrDate(value) {
	var text = htmlToText(value);

	if (!text) {
		return null;
	}

	/*
	 * Prefer explicit YYYY-MM-DD values if HBR supplies a datetime
	 * attribute. Using noon UTC avoids accidental day changes caused
	 * by timezone conversion.
	 */
	var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);

	if (iso) {
		return new Date(Date.UTC(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10), 12, 0, 0));
	}

	/*
	 * HBR currently renders dates such as "September 21, 2026".
	 */
	var months = {
		january: 0,
		february: 1,
		march: 2,
		april: 3,
		may: 4,
		june: 5,
		july: 6,
		august: 7,
		september: 8,
		october: 9,
		november: 10,
		december: 11,
	};

	var human = text.match(
		/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/i,
	);

	if (human) {
		return new Date(Date.UTC(parseInt(human[3], 10), months[human[1].toLowerCase()], parseInt(human[2], 10), 12, 0, 0));
	}

	var fallback = new Date(text);

	return isNaN(fallback.getTime()) ? null : fallback;
}

/*
 * Tapestry connector JavaScript does not provide a browser DOM.
 *
 * HBR's page currently represents articles as <li class="stream-entry">.
 * Because those entries contain nested <li> elements, matching a whole
 * entry with a simple closing-tag regex is unreliable. Instead, find
 * the start of each stream entry and slice the page between starts.
 */
function splitStreamEntries(html) {
	var starts = [];
	var expression = /<li\b[^>]*\bclass\s*=\s*["'][^"']*\bstream-entry\b[^"']*["'][^>]*>/gi;

	var match;

	while ((match = expression.exec(html)) !== null) {
		starts.push(match.index);
	}

	var entries = [];

	for (var i = 0; i < starts.length; i++) {
		var end = i + 1 < starts.length ? starts[i + 1] : html.length;

		entries.push(html.slice(starts[i], end));
	}

	return entries;
}

function findArticleLink(block) {
	var linkExpression = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

	var match;

	while ((match = linkExpression.exec(block)) !== null) {
		var uri = absoluteHbrUrl(match[1]);
		var title = htmlToText(match[2]);

		/*
		 * Normal HBR article URLs currently look like:
		 * https://hbr.org/2026/09/article-slug
		 *
		 * This lets us identify the article link without depending
		 * on HBR's heading classes or exact HTML nesting.
		 */
		if (uri && /^https:\/\/(?:www\.)?hbr\.org\/20\d{2}\/\d{2}\//i.test(uri) && title) {
			return {
				uri: uri,
				title: title,
			};
		}
	}

	return null;
}

function findPublicationDate(block) {
	/*
	 * First try any <time> element in the stream entry.
	 *
	 * Do not depend on the surrounding li.pubdate structure because
	 * HBR may return slightly different markup to different clients.
	 */
	var timeMatch = block.match(/<time\b([^>]*)>([\s\S]*?)<\/time>/i);

	if (timeMatch) {
		var dateValue = extractAttribute(timeMatch[1], "datetime") || htmlToText(timeMatch[2]);

		var parsed = parseHbrDate(dateValue);

		if (parsed && !isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	/*
	 * Fallback: search the visible text of the whole entry for an
	 * English-language HBR publication date.
	 */
	var visibleText = htmlToText(block);

	var dateMatch = visibleText.match(
		/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i,
	);

	if (dateMatch) {
		var fallbackDate = parseHbrDate(dateMatch[0]);

		if (fallbackDate && !isNaN(fallbackDate.getTime())) {
			return fallbackDate;
		}
	}

	return null;
}

function parseEntry(block, index) {
	var openingEnd = block.indexOf(">");
	var openingTag = openingEnd >= 0 ? block.slice(0, openingEnd + 1) : "";

	/*
	 * Skip advertising and sponsored entries.
	 */
	if (/stream-ad-container/i.test(block)) {
		console.log("HBR entry " + index + ": skipped advertisement");
		return null;
	}

	if (/\bclass\s*=\s*["'][^"']*\bsponsored\b[^"']*["']/i.test(openingTag)) {
		console.log("HBR entry " + index + ": skipped sponsored content");
		return null;
	}

	/*
	 * Find the article using its URL rather than depending on
	 * h3.hed or another specific heading structure.
	 */
	var article = findArticleLink(block);

	if (!article) {
		console.log("HBR entry " + index + ": no HBR article URL/title found");
		return null;
	}

	/*
	 * Publication date.
	 */
	var date = findPublicationDate(block);

	if (!date) {
		console.log("HBR entry " + index + ": no usable publication date found for " + article.uri);
		return null;
	}

	/*
	 * Authors.
	 *
	 * Retain the existing HBR byline-list parser, but authors are
	 * optional so changes to the byline markup cannot kill the item.
	 */
	var authorName = "Harvard Business Review";

	var bylineMatch = block.match(/<ul\b[^>]*\bclass\s*=\s*["'][^"']*\bbyline-list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);

	if (bylineMatch) {
		var authors = [];
		var authorExpression = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

		var authorMatch;

		while ((authorMatch = authorExpression.exec(bylineMatch[1])) !== null) {
			var author = htmlToText(authorMatch[1]);

			if (author) {
				authors.push(author);
			}
		}

		if (authors.length > 0) {
			authorName = authors.join(", ");
		}
	}

	/*
	 * HBR's short article description.
	 * Optional, so a changed description container cannot prevent
	 * the article itself from being imported.
	 */
	var description = "";

	var descriptionMatch = block.match(
		/<(?:div|p)\b[^>]*\bclass\s*=\s*["'][^"']*\bdek\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p)>/i,
	);

	if (descriptionMatch) {
		description = htmlToText(descriptionMatch[1]);
	}

	/*
	 * Create Tapestry item.
	 */
	var item = Item.createWithUriDate(article.uri, date);

	item.title = article.title;

	if (description) {
		item.body = "<p>" + escapeHtml(description) + "</p>";
	}

	var identity = Identity.createWithName(authorName);

	identity.uri = "https://hbr.org";

	item.author = identity;

	console.log("HBR entry " + index + ": parsed " + article.title);

	return item;
}

function load() {
	var headers = {
		Accept: "text/html,application/xhtml+xml",
		"Accept-Language": "en-US,en;q=0.9",
	};

	/*
	 * sendConditionalRequest() is the released Tapestry 1.3+ API.
	 * If HBR returns HTTP 304, the promise resolves to null.
	 */
	sendConditionalRequest(site, "GET", null, headers, false)
		.then(function (html) {
			if (html === null) {
				processResults(null);
				return;
			}

			var entries = splitStreamEntries(html);
			console.log("HBR: found " + entries.length + " stream entries");

			if (entries.length === 0) {
				throw new Error(
					"HBR returned a page, but no article stream entries were found. HBR may have changed the structure of its The Latest page.",
				);
			}

			var items = [];

			for (var i = 0; i < entries.length; i++) {
				var item = parseEntry(entries[i], i);
				if (item) {
					items.push(item);
				}
			}

			if (items.length === 0) {
				throw new Error("HBR article entries were found, but none could be converted into Tapestry items.");
			}

			processResults(items);
		})
		.catch(function (error) {
			processError(error);
		});
}
