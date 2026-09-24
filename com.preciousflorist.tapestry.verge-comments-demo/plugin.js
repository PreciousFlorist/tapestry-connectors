/* Read-only proof of concept using the public Coral widget's persisted request.
 * These identifiers come from Coral's published 9.11.8 stream bundle.
 * No subscriber feed URL, account cookie, or token is included.
 */
var articleUrl = "https://www.theverge.com/bulletin/839889/the-verge-subscription-turns-one";
var storyId = "dmcyOnBvc3Q6ODM5ODg5";
var endpoint = "https://theverge.coral.coralproject.net/api/graphql";
var publisherIcon = "https://www.theverge.com/static-assets/icons/favicon-96x96.png";

function verify() {
    processVerification({ displayName: "The Verge", icon: publisherIcon, baseUrl: "https://www.theverge.com/" });
}

function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function articleItem(html) {
    var match = html.match(/<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (!match) { throw new Error("The Verge article data was not found."); }
    var data = JSON.parse(match[1]);
    var responses = data.props.pageProps.hydration.responses;
    var node = null;
    responses.some(function (response) {
        var candidate = response.data && response.data.node;
        if (candidate && candidate.id === storyId && Array.isArray(candidate.blocks)) { node = candidate; return true; }
        return false;
    });
    if (!node) { throw new Error("The demo article's content was not found."); }
    if (node.isPaywallEligible) { throw new Error("This demo only imports the public test article. Subscriber articles require your subscriber feed."); }
    var date = new Date(node.publishedAt);
    if (isNaN(date.getTime())) { throw new Error("The article publication date is invalid."); }
    var item = Item.createWithUriDate(articleUrl, date);
    var authors = (node.authors || []).map(function (author) { return escapeHtml(author.name); }).join(", ");
    var parts = ["<h2>" + escapeHtml(node.title) + "</h2>"];
    if (authors) { parts.push("<p>By " + authors + "</p>"); }
    var lede = node.ledeMedia && node.ledeMedia.image;
    var image = lede || (node.featuredImage && node.featuredImage.image);
    if (image) {
        var imageUrl = image.originalUrl || (image.thumbnails && image.thumbnails.horizontal && image.thumbnails.horizontal.url);
        if (imageUrl) { parts.push('<p><img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(image.alt || "") + '" /></p>'); }
    }
    var paragraphs = 0;
    node.blocks.forEach(function (block) {
        if (block.__typename === "CoreParagraphBlockType") {
            parts.push("<p>" + block.paragraphContents.map(function (content) { return content.html; }).join("") + "</p>");
            paragraphs++;
        } else if (block.__typename !== "RelatedPostsBlockType") {
            throw new Error("The demo article contains an unsupported block: " + block.__typename);
        }
    });
    if (!paragraphs) { throw new Error("The article has no readable paragraphs."); }
    item.body = parts.join("\n");
    var publisher = Identity.createWithName("The Verge");
    publisher.uri = "https://www.theverge.com/";
    publisher.avatar = publisherIcon;
    item.author = publisher;
    item.actions = { comments: storyId };
    return item;
}

function load() {
    sendRequest(articleUrl, "GET", null, { Accept: "text/html" }, true).then(function (text) {
        var response = JSON.parse(text);
        if (response.status !== 200) { throw new Error("The Verge article request failed (HTTP " + response.status + ")."); }
        processResults([articleItem(response.body)]);
    }).catch(function (error) { processError(error); });
}

function commentItems(story, originalItem) {
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
            var item = Item.createWithUriDate(articleUrl + "?commentID=" + encodeURIComponent(id), date);
            item.body = comment.body;
            var author = comment.author || {};
            var identity = Identity.createWithName(author.username || "Unknown commenter");
            if (author.avatar) { identity.avatar = author.avatar; }
            item.author = identity;
            if (comment.parent && comment.parent.author) {
                item.annotations = [Annotation.createWithText("Reply to " + (comment.parent.author.username || "another commenter"))];
            }
            if (entry.children.length || comment.replyCount > 0) { item.actions = { comments: id }; }
            results.push(item);
        }
        entry.children.forEach(visit);
    }
    roots.forEach(visit);
    // Preserve readable replies even if their parent was removed or a malformed cycle was returned.
    order.forEach(visit);
    console.log("Verge comments demo: " + (results.length - 1) + " readable comments");
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
        if (pageNumber > 20) { return Promise.reject(new Error("This discussion is too large for the demo. Open it on The Verge to continue.")); }
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

function loadDiscussion() {
    return coralRequest("fe810f606e292cc9fe27e8975d5dcd9f", "AllCommentsTabContainerPaginationQuery", {
        storyID: storyId, count: 10, cursor: null, flattenReplies: true,
        orderBy: "CREATED_AT_ASC", ratingFilter: null, refreshStream: false, tag: null
    }).then(function (data) {
        var story = data && data.story;
        if (!story || !story.comments || !Array.isArray(story.comments.edges)) {
            throw new Error("The Verge returned no readable comment connection for this article.");
        }
        // Limit simultaneous requests while replacing each preview with its complete reply connection.
        var index = 0;
        function worker() {
            if (index >= story.comments.edges.length) { return Promise.resolve(); }
            var comment = story.comments.edges[index++].node;
            if (!comment) { return worker(); }
            return loadReplies(comment.id).then(function (replies) {
                comment.replies = replies;
                return worker();
            });
        }
        return Promise.all([worker(), worker(), worker()]).then(function () { return story; });
    });
}

function performAction(actionId, actionValue, item) {
    if (actionId !== "comments") {
        actionComplete(null, new Error("Unsupported action: " + actionId));
        return;
    }
    var request = actionValue && actionValue !== storyId
        ? loadReplies(actionValue).then(function (replies) { return { comments: replies }; })
        : loadDiscussion();
    return request.then(function (story) {
        actionComplete(commentItems(story, item));
    }).catch(function (error) { actionComplete(null, error); });
}
