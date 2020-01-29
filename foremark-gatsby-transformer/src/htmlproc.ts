import {JSDOM} from 'jsdom';

export function createExcerptHtmlForHtml(html: string, limit: number): string {
    const dom = new JSDOM(
        '<html xmlns="http://www.w3.org/1999/xhtml" />',
        {contentType: 'application/xhtml+xml'},
    );
    const document = dom.window.document;
    let el = document.createElement('main');
    el.innerHTML = html;

    let value = 0;
    const traverse = (node: Node) => {
        if (isText(node)) {
            const text = node.textContent || '';
            if (value + text.length > limit) {
                node.textContent = text.substr(0, limit - value) + "…";

                // Prune all remaining nodes
                return true;
            }

            value += text.length;
        } else if (isElement(node)) {
            // Do not truncate the document inside an indivisible element
            if (/^svg|mf-eq|mf-eq-display$/i.test(node.tagName)) {
                return false;
            }

            let child: Node | null = node.firstChild;

            while (child) {
                if (!nodeShouldBeIncludedInExcerpt(child)) {
                    const next = child.nextSibling;
                    node.removeChild(child);
                    child = next;
                    continue;
                }

                if (nodeShouldBeDissolved(child)) {
                    const nextSibling = child.nextSibling;
                    while (child.firstChild) {
                        node.insertBefore(child.firstChild, nextSibling);
                    }

                    const next = child.nextSibling;
                    node.removeChild(child);
                    child = next;
                    continue;
                }

                if (traverse(child)) {
                    // Prune all remaining nodes
                    while (child.nextSibling) {
                        node.removeChild(child.nextSibling);
                    }

                    return true;
                }

                child = child.nextSibling;
            }
        }
        return false;
    };

    traverse(el);

    if (isElement(el.firstChild) && el.firstChild.tagName.match(/mf-document/i)) {
        return el.firstChild.innerHTML;
    }

    return el.innerHTML;
}

function nodeShouldBeIncludedInExcerpt(e: Node): boolean {
    return !isElement(e) || !/^mf-(title|note|figure|lead|cite|sidenote)|table$/i.test(e.tagName);
}

function nodeShouldBeDissolved(e: Node): e is Element {
    return isElement(e) && /^a$/i.test(e.tagName);
}

function isElement(x: Node | null | undefined): x is Element {
    return x != null && x.nodeType === 1;
}

function isText(x: Node | null | undefined): x is Text {
    return x != null && (x.nodeType === 3 || x.nodeType === 4);
}