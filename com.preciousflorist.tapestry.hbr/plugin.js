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

function parseEntry(block) {
	var openingEnd = block.indexOf(">");
	var openingTag = openingEnd >= 0 ? block.slice(0, openingEnd + 1) : "";

	/*
	 * Exclude HBR advertising and sponsored-content entries.
	 */
	if (/stream-ad-container/i.test(block)) {
		return null;
	}

	if (/\bclass\s*=\s*["'][^"']*\bsponsored\b[^"']*["']/i.test(openingTag)) {
		return null;
	}

	/*
	 * Current HBR structure:
	 *   <h3 class="hed"><a href="/...">Article title</a></h3>
	 */
	var titleMatch = block.match(
		/<h3\b[^>]*\bclass\s*=\s*["'][^"']*\bhed\b[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
	);

	if (!titleMatch) {
		return null;
	}

	var uri = absoluteHbrUrl(titleMatch[1]);
	var title = htmlToText(titleMatch[2]);

	if (!uri || !title) {
		return null;
	}

	/*
	 * Preserve multiple authors when HBR provides them.
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
	 * Publication date.
	 */
	var dateMatch = block.match(
		/<li\b[^>]*\bclass\s*=\s*["'][^"']*\bpubdate\b[^"']*["'][^>]*>[\s\S]*?<time\b([^>]*)>([\s\S]*?)<\/time>/i,
	);

	if (!dateMatch) {
		return null;
	}

	var dateValue = extractAttribute(dateMatch[1], "datetime") || htmlToText(dateMatch[2]);

	var date = parseHbrDate(dateValue);

	/*
	 * Do not substitute the current date if parsing fails. Doing so
	 * would make old articles jump to the top after every refresh.
	 */
	if (!date || isNaN(date.getTime())) {
		return null;
	}

	/*
	 * HBR's short article description ("dek").
	 */
	var description = "";
	var descriptionMatch = block.match(/<div\b[^>]*\bclass\s*=\s*["'][^"']*\bdek\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

	if (descriptionMatch) {
		description = htmlToText(descriptionMatch[1]);
	}

	var item = Item.createWithUriDate(uri, date);

	item.title = title;

	if (description) {
		item.body = "<p>" + escapeHtml(description) + "</p>";
	}

	var identity = Identity.createWithName(authorName);
	identity.uri = "https://hbr.org";
	item.author = identity;

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
				processResults([]);
				return;
			}

			var entries = splitStreamEntries(html);

			if (entries.length === 0) {
				throw new Error(
					"HBR returned a page, but no article stream entries were found. HBR may have changed the structure of its The Latest page.",
				);
			}

			var items = [];

			for (var i = 0; i < entries.length; i++) {
				var item = parseEntry(entries[i]);

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
