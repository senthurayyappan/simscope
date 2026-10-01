"""The tab icon: the viewer's magnifying-glass mark on a dark tile."""

import base64

_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
    '<rect width="24" height="24" rx="5" fill="#171717"/>'
    '<g fill="none" stroke="#fafafa" stroke-linecap="round"'
    ' stroke-linejoin="round">'
    '<circle cx="10.5" cy="10.5" r="6.25" stroke-width="2"/>'
    '<path d="M15.2 15.2 20.5 20.5" stroke-width="2.4"/>'
    '<path d="M7 11.4c.9 0 1.1-2.6 2-2.6s1.1 3.4 2 3.4'
    ' 1.1-4.2 2-4.2.9 3 1.5 3"'
    ' stroke-width="1.1"/></g></svg>'
)

ICON_LINK = (
    '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,'
    + base64.b64encode(_SVG.encode()).decode()
    + '">'
)
"""A ``<link>`` for the page head; a data URI, so it adds no request."""
