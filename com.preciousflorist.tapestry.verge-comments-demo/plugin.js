/* Read-only proof of concept using the public Coral widget's persisted request.
 * These identifiers come from Coral's published 9.11.8 stream bundle.
 * No subscriber feed URL, account cookie, or token is included.
 */
var articleUrl = "https://www.theverge.com/bulletin/839889/the-verge-subscription-turns-one";
var storyId = "dmcyOnBvc3Q6ODM5ODg5";
var endpoint = "https://theverge.coral.coralproject.net/api/graphql";

function articleItem() {
    var item = Item.createWithUriDate(articleUrl, new Date("2025-12-08T16:00:42Z"));
    item.title = "The Verge subscription turns one: comments demo";
    item.body = "<p>Open Comments to load a live discussion in Tapestry. This demo shows the first 10 top-level comments and the reply previews returned with them. It does not load the subscriber feed or the article body.</p>";
    item.actions.add("comments");
    return item;
}

function load() {
    processResults([articleItem()]);
}

function commentItems(story) {
    var results = [articleItem()];
    var seen = {};
    var skipped = 0;
    function visit(connection) {
        if (!connection || !connection.edges) { return; }
        connection.edges.forEach(function (edge) {
            var comment = edge.node;
            if (!comment || seen[comment.id]) { return; }
            seen[comment.id] = true;
            var date = new Date(comment.createdAt);
            if (!comment.deleted && comment.body && !isNaN(date.getTime())) {
                var item = Item.createWithUriDate(articleUrl + "?commentID=" + encodeURIComponent(comment.id), date);
                item.body = comment.body;
                var author = comment.author || {};
                var identity = Identity.createWithName(author.username || "Unknown commenter");
                if (author.avatar) { identity.avatar = author.avatar; }
                item.author = identity;
                if (comment.parent && comment.parent.author) {
                    item.annotations = [Annotation.createWithText("Reply to " + (comment.parent.author.username || "another commenter"))];
                }
                results.push(item);
            } else { skipped++; }
            visit(comment.replies);
        });
    }
    visit(story.comments);
    var total = story.commentCounts && story.commentCounts.totalPublished;
    results[0].body = "<p>Live comment preview: " + (results.length - 1) + " comments loaded" + (typeof total === "number" ? " from " + total + " published comments" : "") + ". Includes up to 10 top-level comments, oldest first, with available reply previews. Further pages and some deeper replies are omitted.</p><p><a href=\"" + articleUrl + "\">Open the full discussion on The Verge</a></p>";
    console.log("Verge comments demo: " + (results.length - 1) + " comments, " + skipped + " unavailable entries skipped");
    return results;
}

function performAction(actionId, actionValue, item) {
    if (actionId !== "comments") {
        actionComplete(null, new Error("Unsupported action: " + actionId));
        return;
    }
    var payload = {
        query: "PERSISTED_QUERY",
        id: "fe810f606e292cc9fe27e8975d5dcd9f",
        operationName: "AllCommentsTabContainerPaginationQuery",
        variables: {
            storyID: storyId, count: 10, cursor: null,
            flattenReplies: true, orderBy: "CREATED_AT_ASC",
            ratingFilter: null, refreshStream: false, tag: null
        }
    };
    sendRequest(endpoint, "POST", JSON.stringify(payload), {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://www.theverge.com"
    }, true).then(function (text) {
        var response = JSON.parse(text);
        var json;
        try { json = JSON.parse(response.body); }
        catch (_) { throw new Error("The Verge comments returned a non-JSON response (HTTP " + response.status + ")."); }
        if (response.status !== 200 || json.error || (json.errors && json.errors.length)) {
            var problem = json.error || (json.errors && json.errors[0]);
            throw new Error("The Verge comments request failed (HTTP " + response.status + "): " + (problem && (problem.message || problem.code) || "unknown error"));
        }
        var story = json.data && json.data.story;
        if (!story || !story.comments || !Array.isArray(story.comments.edges)) {
            throw new Error("The Verge returned no readable comment connection for this article.");
        }
        actionComplete(commentItems(story));
    }).catch(function (error) {
        actionComplete(null, error);
    });
}
