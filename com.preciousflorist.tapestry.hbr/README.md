# Harvard Business Review (Unofficial) for Tapestry

An unofficial third-party connector that adds recent Harvard Business Review
items from the public **The Latest** page to an Iconfactory Tapestry timeline.

Source page:

https://hbr.org/the-latest

## What it imports

For each supported item, the connector attempts to include:

- article title
- publication date
- author or authors
- HBR's short public article summary
- original HBR article URL

## What it does not do

This connector:

- does not contain user credentials
- does not contain subscriber information
- does not log in to HBR
- does not retrieve subscriber-only article bodies
- does not bypass HBR access controls
- does not send information to a third-party service

The connector requests HBR's public `The Latest` webpage directly from Tapestry.

## Compatibility

This version targets Tapestry's released 1.3+ connector API.

It intentionally does **not** target the 2.0 connector API currently documented
on the `main` branch of Iconfactory's GitHub repository, because the currently
released Tapestry app remains in the 1.x series.

## Maintenance note

HBR does not provide a currently usable public RSS feed for this page. This
connector therefore depends on HBR's HTML structure. If HBR redesigns the
`The Latest` page, the parsing rules may need to be updated.

## Status

Unofficial community connector. Not affiliated with, endorsed by, or maintained
by Harvard Business Review, Harvard Business Publishing, Harvard Business School,
or The Iconfactory.
