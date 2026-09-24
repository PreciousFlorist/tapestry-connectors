/* The Verge RSS/Atom reader with read-only Coral comments. Tapestry 1.4 API.
 * Subscriber URLs are entered in Tapestry, never embedded in this connector.
 */
var endpoint = "https://theverge.coral.coralproject.net/api/graphql";
var publisherIcon = "https://www.theverge.com/static-assets/icons/favicon-96x96.png";

function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function list(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function textValue(value) { return typeof value === "string" ? value.trim() : ""; }
function webUrl(value, base) {
    value = textValue(value);
    if (!value) { return null; }
    if (/^https?:\/\/[^\s/]+/i.test(value)) { return value; }
    if (/^\/\//.test(value)) { return "https:" + value; }
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) { return null; }
    var origin = String(base || "").match(/^https?:\/\/[^/]+/i);
    if (!origin) { return null; }
    var basePath = String(base).split(/[?#]/)[0].slice(origin[0].length) || "/";
    var path = value.charAt(0) === "/" ? value : basePath.replace(/[^/]*$/, "") + value;
    var parts = [];
    path.split("/").forEach(function (part) { if (part === "..") { parts.pop(); } else if (part !== ".") { parts.push(part); } });
    return origin[0] + parts.join("/");
}
function isVergeArticle(url) { return /^https:\/\/(?:www\.)?theverge\.com\//i.test(url || ""); }
function alternate(node) {
    var links = list(node.link$attrs);
    var link = links.filter(function (a) { return !a.rel || a.rel === "alternate"; })[0];
    return link && link.href;
}
function htmlField(node, key, atom) {
    if (node[key + "$xhtml"]) { return node[key + "$xhtml"]; }
    var value = textValue(node[key]);
    var attrs = node[key + "$attrs"] || {};
    return atom && (!attrs.type || attrs.type === "text") ? escapeHtml(value) : value;
}
function parseFeed(document, feedUrl) {
    var atom = !!document.feed;
    var channel = atom ? document.feed : document.rss && document.rss.channel;
    if (!channel) { throw new Error("Enter an RSS or Atom feed URL from your Verge subscription settings, rather than the website address."); }
    var base = webUrl(atom ? alternate(channel) : channel.link, feedUrl) || "https://www.theverge.com/";
    var image = channel.image && channel.image.url;
    var itunes = channel["itunes:image$attrs"];
    var icon = [channel.icon, channel.logo, image, itunes && itunes.href].map(function (candidate) { return webUrl(candidate, feedUrl); }).filter(Boolean)[0] || publisherIcon;
    return { atom: atom, name: textValue(channel.title) || "The Verge", base: base, icon: icon, entries: list(atom ? channel.entry : channel.item) };
}
async function readFeed() {
    if (typeof site !== "string" || !/^https:\/\//i.test(site.trim())) { throw new Error("Enter your full HTTPS subscriber feed URL in the feed settings."); }
    var response;
    try { response = JSON.parse(await sendRequest(site.trim(), "GET", null, { Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml" }, true)); }
    catch (_) { throw new Error("The feed could not be downloaded. Check your subscriber feed URL and connection."); }
    if (response.status !== 200) { throw new Error("The feed request failed (HTTP " + response.status + "). Check that your subscriber feed URL is current."); }
    var document;
    try { document = await xmlParse(response.body); }
    catch (_) { throw new Error("The URL did not return readable feed XML. Copy the subscriber RSS URL from The Verge."); }
    return parseFeed(document, response.url || site.trim());
}
async function verify() {
    try {
        var feed = await readFeed();
        processVerification({ displayName: feed.name, icon: feed.icon, baseUrl: feed.base });
    } catch (error) { processError(error); }
}
function feedItems(feed) {
    var results = [];
    var seen = Object.create(null);
    feed.entries.forEach(function (entry) {
        var url = webUrl(feed.atom ? alternate(entry) : entry.link, feed.base);
        var date = new Date(feed.atom ? entry.published || entry.updated : entry.pubDate || entry["dc:date"]);
        if (!url || seen[url] || isNaN(date.getTime())) { return; }
        seen[url] = true;
        var item = Item.createWithUriDate(url, date);
        var title = htmlField(entry, "title", feed.atom);
        var body = feed.atom ? htmlField(entry, "content", true) || htmlField(entry, "summary", true)
            : textValue(entry["content:encoded"]) || textValue(entry.description);
        var byline = feed.atom ? list(entry.author).map(function (a) { return textValue(a.name); }).filter(Boolean).join(", ")
            : list(entry["dc:creator"] || entry.author).map(textValue).filter(Boolean).join(", ");
        item.body = (title ? "<h2>" + title + "</h2>\n" : "") + (byline ? "<p>By " + escapeHtml(byline) + "</p>\n" : "") + body;
        var publisher = Identity.createWithName(feed.name);
        publisher.uri = feed.base;
        publisher.avatar = feed.icon;
        item.author = publisher;
        // Preserve body images for Tapestry's automatic media extraction. Add separate enclosures only when needed.
        if (!/<(?:img|video|audio)\b/i.test(body)) {
            var media = list(entry["enclosure$attrs"]).concat(list(entry["media:content$attrs"]));
            if (feed.atom) { media = media.concat(list(entry.link$attrs).filter(function (a) { return a.rel === "enclosure"; })); }
            var attachments = [];
            media.forEach(function (m) {
                var mediaUrl = webUrl(m.url || m.href, url);
                if (!mediaUrl || !/^(image|audio|video)\//.test(m.type || "")) { return; }
                var attachment = MediaAttachment.createWithUrl(mediaUrl);
                attachment.mimeType = m.type;
                attachments.push(attachment);
            });
            if (attachments.length) { item.attachments = attachments; }
        }
        if (isVergeArticle(url)) { item.actions = { comments: JSON.stringify({ articleUrl: url }) }; }
        results.push(item);
    });
    if (feed.entries.length && !results.length) { throw new Error("The feed contains entries, but none have a usable article link and publication date."); }
    return results;
}
async function load() {
    try { processResults(feedItems(await readFeed())); }
    catch (error) { processError(error); }
}
async function articleStoryId(articleUrl) {
    if (!isVergeArticle(articleUrl)) { throw new Error("Comments are supported for The Verge article URLs only."); }
    var response = JSON.parse(await sendRequest(articleUrl, "GET", null, { Accept: "text/html" }, true));
    if (response.status !== 200) { throw new Error("Could not open the article's comment information (HTTP " + response.status + ")."); }
    var properties;
    try { properties = await extractProperties(response.body); } catch (_) { properties = null; }
    var id = properties && properties["cse-coral-id"];
    // cse-coral-id is a name-based meta tag; some extractProperties versions expose only property-based tags.
    if (!id) {
        var tags = response.body.match(/<meta\b[^>]*>/gi) || [];
        tags.some(function (tag) {
            if (!/\bname\s*=\s*["']cse-coral-id["']/i.test(tag)) { return false; }
            var match = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
            if (match) { id = match[1]; }
            return !!id;
        });
    }
    if (!id || typeof id !== "string") { throw new Error("This article does not expose a readable comments thread. Open it on The Verge to check availability."); }
    return id;
}
function commentItems(story, originalItem, articleUrl) {
    var results = [originalItem];
    var nodes = Object.create(null);
    var order = [];
    function collect(connection) {
        (connection && connection.edges || []).forEach(function (edge) {
            var comment = edge.node;
            if (!comment || nodes[comment.id]) { return; }
            nodes[comment.id] = { comment: comment, children: [] };
            order.push(comment.id);
            collect(comment.replies);
        });
    }
    collect(story.comments);
    var roots = [];
    order.forEach(function (id) {
        var entry = nodes[id];
        var parentId = entry.comment.parent && entry.comment.parent.id;
        if (parentId && nodes[parentId] && parentId !== id) { nodes[parentId].children.push(id); }
        else { roots.push(id); }
    });
    var seen = Object.create(null);
    function visit(id) {
        if (seen[id]) { return; }
        seen[id] = true;
        var entry = nodes[id];
        var comment = entry.comment;
        var date = new Date(comment.createdAt);
        if (!comment.deleted && comment.body && !isNaN(date.getTime())) {
            var item = Item.createWithUriDate(articleUrl.split("#")[0] + (articleUrl.indexOf("?") >= 0 ? "&" : "?") + "commentID=" + encodeURIComponent(id), date);
            item.body = comment.body;
            var author = comment.author || {};
            var identity = Identity.createWithName(author.username || "Unknown commenter");
            if (author.avatar) { identity.avatar = author.avatar; }
            item.author = identity;
            if (comment.parent && comment.parent.author) {
                item.annotations = [Annotation.createWithText("Reply to " + (comment.parent.author.username || "another commenter"))];
            }
            if (entry.children.length || comment.replyCount > 0) { item.actions = { comments: JSON.stringify({ articleUrl: articleUrl, commentId: id }) }; }
            results.push(item);
        }
        entry.children.forEach(visit);
    }
    roots.forEach(visit);
    // Preserve readable replies even if their parent was removed or a malformed cycle was returned.
    order.forEach(visit);
    console.log("Verge comments: " + (results.length - 1) + " readable comments");
    return results;
}

function coralRequest(id, operationName, variables) {
    return sendRequest(endpoint, "POST", JSON.stringify({
        query: "PERSISTED_QUERY", id: id, operationName: operationName, variables: variables
    }), {
        "Content-Type": "application/json", "Accept": "application/json", "Origin": "https://www.theverge.com"
    }, true).then(function (text) {
        var response = JSON.parse(text);
        var json;
        try { json = JSON.parse(response.body); }
        catch (_) { throw new Error("The Verge comments returned a non-JSON response (HTTP " + response.status + ")."); }
        if (response.status !== 200 || json.error || (json.errors && json.errors.length)) {
            var problem = json.error || (json.errors && json.errors[0]);
            throw new Error("The Verge comments request failed (HTTP " + response.status + "): " + (problem && (problem.message || problem.code) || "unknown error"));
        }
        return json.data;
    });
}

// Coral's published flattened-replies operation includes every descendant, not just direct children.
function loadReplies(commentId) {
    var edges = [];
    var cursors = Object.create(null);
    function page(cursor, pageNumber) {
        if (pageNumber > 20) { return Promise.reject(new Error("This discussion exceeds the connector's loading limit. Open it on The Verge to continue.")); }
        return coralRequest("486c9d9f9c415dc5337646dfc5be5cde", "ReplyListContainerLastFlattenedPaginationQuery", {
            commentID: commentId, count: 100, cursor: cursor, flattenReplies: true,
            orderBy: "CREATED_AT_ASC", refreshStream: false
        }).then(function (data) {
            var connection = data && data.comment && data.comment.replies;
            if (!connection || !Array.isArray(connection.edges) || !connection.pageInfo) {
                throw new Error("The Verge returned no readable replies for this comment.");
            }
            edges = edges.concat(connection.edges);
            if (connection.pageInfo.hasNextPage) {
                var next = connection.pageInfo.endCursor;
                if (!next || cursors[next]) { throw new Error("The Verge reply pagination stopped advancing."); }
                cursors[next] = true;
                return page(next, pageNumber + 1);
            }
            return { edges: edges };
        });
    }
    return page(null, 1);
}

function incompleteReplies(connection) {
    if (!connection) { return false; }
    if (connection.pageInfo && connection.pageInfo.hasNextPage) { return true; }
    return (connection.edges || []).some(function (edge) {
        var c = edge.node;
        return c && ((c.replyCount > 0 && !c.replies) || incompleteReplies(c.replies));
    });
}
async function loadDiscussion(storyId) {
    var edges = [], cursor = null, cursors = Object.create(null);
    for (var page = 0; page < 20; page++) {
        var data = await coralRequest("fe810f606e292cc9fe27e8975d5dcd9f", "AllCommentsTabContainerPaginationQuery", {
            storyID: storyId, count: 50, cursor: cursor, flattenReplies: true,
            orderBy: "CREATED_AT_ASC", ratingFilter: null, refreshStream: false, tag: null
        });
        var connection = data && data.story && data.story.comments;
        if (!connection || !Array.isArray(connection.edges) || !connection.pageInfo) { throw new Error("The Verge returned no readable comments for this article."); }
        edges = edges.concat(connection.edges);
        if (!connection.pageInfo.hasNextPage) { break; }
        cursor = connection.pageInfo.endCursor;
        if (!cursor || cursors[cursor]) { throw new Error("The Verge comment pagination stopped advancing."); }
        cursors[cursor] = true;
        if (page === 19) { throw new Error("This discussion exceeds the connector's loading limit. Open it on The Verge to continue."); }
    }
    var index = 0;
    async function worker() {
        while (index < edges.length) {
            var comment = edges[index++].node;
            if (comment && incompleteReplies(comment.replies)) { comment.replies = await loadReplies(comment.id); }
        }
    }
    await Promise.all([worker(), worker(), worker()]);
    return { comments: { edges: edges } };
}
async function performAction(actionId, actionValue, item) {
    try {
        if (actionId !== "comments") { throw new Error("Unsupported action: " + actionId); }
        var context;
        try { context = JSON.parse(actionValue); } catch (_) {
            // Old stored demo items can still open their own discussion after an upgrade.
            context = { articleUrl: String(item.uri).split("?")[0] };
        }
        if (!context || !isVergeArticle(context.articleUrl)) { throw new Error("This item does not have a Verge article URL."); }
        var story = context.commentId ? { comments: await loadReplies(context.commentId) }
            : await loadDiscussion(await articleStoryId(context.articleUrl));
        actionComplete(commentItems(story, item, context.articleUrl));
    } catch (error) { actionComplete(null, error); }
}
