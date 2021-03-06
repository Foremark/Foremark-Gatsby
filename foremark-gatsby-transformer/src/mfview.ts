// Ported from Foremark's `mfview.ts`.
//  - TODO: Media handlers are not supported yet.
//  - KaTeX and Highlight.js are now synchronously loaded via `import`.
//  - Global references to DOM types were removed because they are inaccessible
//    from a Node.js environment.
import * as Katex from 'katex';
import * as Hljs from 'highlight.js';

import {forEachNodePreorder, transformTextNodeWith} from 'foremark/dist/utils/dom';
import {TagNames, AttributeNames, FIGURE_STANDARD_ID_RE} from 'foremark/dist/foremark';
import {ViewerConfig} from './config';
import {toSvg} from './diagram';
import {processMediaElement, MediaHandlerContext} from './media';

/** Tags introduced by `prepareForemarkForViewing`. */
export const enum ViewTagNames {
    FloatingElementLabel = 'mf-label',
    Sidenote = 'mf-sidenote',
    DiagramInner = 'mf-diagram-inner',
    CodeLineHead = 'mf-code-line',
}

const enum FloatType {
    Note,
    Figure,
    Citation,
}

let nextNonce = 1;
function makeNonce(): string {
    return 'e-' + (nextNonce++);
}

function isElement(x: Node | null | undefined): x is Element {
    return x != null && x.nodeType === 1;
}

function isText(x: Node | null | undefined): x is Text {
    return x != null && x.nodeType === 3;
}

export type Context = MediaHandlerContext;

/**
 * Transforms Foremark XML for viewing.
 */
export function prepareForemarkForViewing(node: Element, config: ViewerConfig, ctx: Context): Promise<void> {
    const document = node.ownerDocument!;

    // Modify headings
    const counter = new Float64Array(10);
    const names: string[] = ['', '', '', '', '', '', '', '', '', ''];
    forEachNodePreorder(node, node => {
        if (!isElement(node)) {
            return;
        }
        const match = node.tagName.match(/^h([1-9])$/i);
        if (match) {
            const assignNumber = config.headingNumbers;
            const level = parseInt(match[1], 10);

            if (assignNumber) {
                counter[level] += 1;
                for (let i = level + 1; i < counter.length; ++i) {
                    counter[i] = 0;
                }
            }

            // Section number in `1.2.3` style
            const number = Array.prototype.slice.call(counter, 1, level + 1).join('.');

            // Determine the ID of the heading. If it doesn't have one, generate
            // one in a Markdeep-compatible way.
            names[level] = encodeURI((node.textContent || '').replace(/\s/g, '').toLowerCase());
            if (!names[level]) {
                // If the heading is empty for some reasons, just use the
                // heading number
                names[level] = number;
            }
            if (level > 1) {
                names[level] = names[level - 1] + '/' + names[level];
            }
            for (let i = level + 1; i < counter.length; ++i) {
                names[i] = names[level];
            }

            let id = node.getAttribute('id');
            if (!id) {
                id = names[level];
            }

            // Insert `<a>` for each heading
            node.removeAttribute('id');
            node.setAttribute('data-anchor', id);
            const a = document.createElement('a');
            a.id = id;
            a.className = 'anchor';
            node.parentElement!.insertBefore(a, node);

            if (assignNumber) {
                // Display the section number
                node.insertAdjacentHTML('afterbegin', `<span class="section-number">${number}</span> `);
            }
        }
    });

    // Process figures and endnotes
    const figureUsageError =
        `<${TagNames.Error}>` +
        `Usage error: <code>${TagNames.Figure}</code>` +
        `</${TagNames.Error}>`;
    const nextFigureNumber = new Map<string, number>();
    let nextEndnoteNumber = 1;

    const refLabelMap = new Map<string, [FloatType, boolean, string]>();
    const floatingContentUsageMap = new Map<string, Element[]>();

    forEachNodePreorder(node, node => {
        if (!isElement(node)) {
            return;
        }

        // Generate `computer` and `label` from `id`
        if (node.tagName === TagNames.Figure) {
            const id = node.getAttribute('id');
            let counter = node.getAttribute('counter');
            let label = node.getAttribute('label');

            if (counter == null && label == null) {
                if (!id) {
                    return;
                }
                const match = id && FIGURE_STANDARD_ID_RE.exec(id);
                if (!match) {
                    node.insertAdjacentHTML('beforebegin', figureUsageError);
                    return;
                }

                const [_, type, sep, base] = match;
                counter = type.toLowerCase();
                label = type.replace(/\{\}/g, '{\u200b}') + (sep === ' ' ? ' ' : '') + '{}';
            }

            // FIXME: How to handle these cases?
            if (counter == null) {
                counter = '';
            }
            if (label == null) {
                label = `??? {}`;
            }

            // Assign a figure number
            const number = (nextFigureNumber.get(counter) || 1);
            nextFigureNumber.set(counter, number + 1);

            label = label.replace(/\{\}/g, `${number}`);

            // Generate a label
            const caption = node.getElementsByTagName(TagNames.FigureCaption)[0];
            if (caption) {
                const labelElem = document.createElement(ViewTagNames.FloatingElementLabel);
                labelElem.textContent = label;
                prependPhrasingContent(labelElem, caption)

                node.setAttribute('aria-labelledby', labelElem.id);
            }

            // Move the caption under a figure
            if (caption) {
                node.appendChild(caption);
            }

            if (id) {
                refLabelMap.set(id, [FloatType.Figure, false, label]);
            }
        } else if (node.tagName === TagNames.Note) {
            const id = node.getAttribute('id');
            if (!id) {
                return;
            }

            // Assign a note number
            const number = nextEndnoteNumber++;

            // Generate a label
            const labelElem = document.createElement(ViewTagNames.FloatingElementLabel);
            const label = `${number}`;
            labelElem.textContent = label;
            prependPhrasingContent(labelElem, node)

            if (id) {
                refLabelMap.set(id, [FloatType.Note, false, label]);
            }
        } else if (node.tagName === TagNames.Cite) {
            const id = node.getAttribute('id');
            let label = node.getAttribute('label');

            if (!label && id) {
                label = id;
            }

            // Generate a label
            if (label) {
                const labelElem = document.createElement(ViewTagNames.FloatingElementLabel);
                labelElem.textContent = `[${label}]`;
                prependPhrasingContent(labelElem, node)
            }

            if (id && label) {
                refLabelMap.set(id, [FloatType.Citation, false, label]);
            }
        } else if (node.tagName === TagNames.Ref) {
            const target = node.getAttribute('to') || '';

            let refs = floatingContentUsageMap.get(target);
            if (refs == null) {
                refs = [];
                floatingContentUsageMap.set(target, refs);
            }

            refs.push(node);
            return false;
        }
    });

    // Wrap the contents of `<TagNodes.Figure>` and `<TagNodes.Note>`.
    //
    //     <TagNames.Figure>
    //         <div>
    //             { children }
    //         </div>
    //     </TagNames.Figure>
    //
    // If a floating element doesn't have `id`, it may be directly layouted in
    // the side margin without being wrapped by `Sidenote`. However, the
    // sidenote layouting requires that a sidenote content is wrapped by
    // at least two wrappers. So, in such cases, an extra wrapper is necessary
    // for proper styling.
    forEachNodePreorder(node, node => {
        if (!isElement(node) ||
            (node.tagName !== TagNames.Figure && node.tagName !== TagNames.Note)) {
            return;
        }

        // Wrap the contents
        const div = node.ownerDocument!.createElement('div');
        while (node.firstChild != null) {
            div.appendChild(node.firstChild);
        }
        node.appendChild(div);
    });

    const sidenotesDisabled = node.classList.contains('no-sidenotes');

    let hasSidenote = false;
    if (!sidenotesDisabled) {
        // On a large screen, we want to display figures and sidenotes in the
        // side margin, and also want them to be located right next to the
        // places where they are referenced.
        //
        // Conditionally changing an element's position in this way is
        // impossible to accomplish using a purely CSS-based solution. So,
        // we basically create a copy of figures and sidenotes to be inserted
        // to a different position, which we call "surrogates".

        /** Decides where to insert the sidenote. */
        const chooseInsertionPosition = (x: Element): [Node | null, Element] => {
            let at: [Node | null, Element] = [x, x.parentElement!];
            for (let n: Element | null = x; n = n!.parentElement; n) {
                // We can't insert a `Sidenote` inside these elements.
                if (
                    // A table has a `overflow: auto` wrapper.
                    n.tagName === 'table' ||
                    // Can't lay out a sidenote inside a sidenote.
                    n.tagName === ViewTagNames.Sidenote ||
                    // `<TagNames.Cite>` has `overflow: hidden`.
                    n.tagName === TagNames.Cite ||
                    // Code blocks use a special font.
                    n.tagName === TagNames.Code || n.tagName === TagNames.CodeBlock ||
                    n.tagName === 'pre' || n.tagName === 'code'
                ) {
                    at = [n, n.parentElement!];
                } else if (
                    // Headings are cloned into the TOC.
                    /h[1-9]/.test(n.tagName) ||
                    // `<TagNames.Admonition>` has `overflow: hidden`.
                    n.tagName === TagNames.Admonition
                ) {
                    at = [n.nextSibling, n.parentElement!];
                }
            }
            return at;
        };

        // Notes and figures:
        //
        // If a floating element has `id` and sidenoting is enabled for it, then
        // clone the element and wrap it with `<ViewTagNames.Sidenote>`,
        // and then insert it to the first place where it's referenced.
        // On a large screen, the original floating content is hidden and
        // this surrogate is displayed instead.
        //
        //     <p>
        //         <!-- The surrogate: -->
        //         <Sidenote>
        //             <Figure>...</Figure>
        //         </Sidenote>
        //         <Ref /> depicts the muscular system of the horse.
        //     </p>
        //     <!-- The original definition: -->
        //     <Figure>...</Figure>
        //
        // If `id` is empty, it cannot be referenced by a body text, so we just
        // put it in the same place whatever the screen size is. Therefore,
        // a surrogate is not necessary.
        forEachNodePreorder(node, node => {
            if (!isElement(node) || (node.tagName !== TagNames.Figure && node.tagName !== TagNames.Note)) {
                return;
            }
            const size = node.getAttribute('size');
            if (size === 'full') {
                // The "full" style needs the side margin to make sense.
                hasSidenote = true;
            }

            if (size === 'large' || size === 'full') {
                // Sidenote creation is disabled for this elemnet.
                return;
            }

            hasSidenote = true;

            if (!node.id) {
                // Surrogate is not needed
                node.classList.add('no-surrogate');
                return;
            }

            const refs = floatingContentUsageMap.get(node.id);
            if (refs == null) {
                // This element is not referenced anywhere. Can't create
                // a side note.
                return;
            }

            const cloned = node.cloneNode(true) as Element;
            const sidenote = node.ownerDocument!.createElement(ViewTagNames.Sidenote);
            cloned.id = 'sidenote.' + node.id;
            sidenote.appendChild(cloned);

            // Decide where to insert the sidenote
            let at = chooseInsertionPosition(refs[0]);
            at[1].insertBefore(sidenote, at[0]);

            // Hide the original element on a large screen
            node.classList.add('hide-sidenote');

            refLabelMap.get(node.id)![1] = true;
        });

        // Citations:
        //
        // They are handled similarly to notes and figures, but multiple
        // surrogates can be created for a single citation. Basically a
        // surrogate is created for each reference. However, we also want to
        // keep number of sidenotes under controls. Therefore, we limit the
        // number of surrogates to one for every subsection.
        const headingMap = new Map<Node, Node | null>();
        let currentHeading: Node | null = null;
        forEachNodePreorder(node, node => {
            if (!isElement(node)) {
                return;
            }
            if (node.tagName === 'h1' || node.tagName === 'h2') {
                currentHeading = node;
            }
            headingMap.set(node, currentHeading);
        });
        forEachNodePreorder(node, node => {
            if (!isElement(node) || node.tagName !== TagNames.Cite || !node.id) {
                return;
            }

            const refs = floatingContentUsageMap.get(node.id);
            if (refs == null) {
                return;
            }

            let lastHeading: Node | null | undefined = void 0;
            for (const ref of refs) {
                const refHeading = headingMap.get(ref);
                if (refHeading === lastHeading) {
                    // This heading already has a surrogate of this citation
                    continue;
                }
                lastHeading = refHeading;

                const cloned = node.cloneNode(true) as Element;
                cloned.id = '';
                cloned.classList.add('surrogate');
                const sidenote = node.ownerDocument!.createElement(ViewTagNames.Sidenote);
                sidenote.appendChild(cloned);

                // Decide where to insert the sidenote
                let at = chooseInsertionPosition(ref);
                at[1].insertBefore(sidenote, at[0]);
            }

            hasSidenote = true;
            refLabelMap.get(node.id)![1] = true;
        });
    }

    if (hasSidenote) {
        // Make a margin for sidenotes
        node.classList.add('has-sidenotes');
    }

    // Resolve `<TagNames.Ref>`s using `refLabelMap` created by the previous step
    forEachNodePreorder(node, node => {
        if (!isElement(node)) {
            return;
        }
        if (node.tagName !== TagNames.Ref) {
            return;
        }

        const target = node.getAttribute('to') || '';
        const [floatType, sidenote, label] = refLabelMap.get(target) || [-1, false, '?'];

        const link = document.createElement('a');
        link.href = '#' + encodeURIComponent(target);

        switch (floatType) {
            case FloatType.Note:
                const sup = document.createElement('sup');
                sup.textContent = label;
                link.appendChild(sup);
                break;
            case FloatType.Figure:
            case FloatType.Citation:
            case -1:
                link.textContent = label;
                break;
            default:
                throw new Error();
        }

        // Replace <TagNames.Ref>` with a link
        node.parentElement!.insertBefore(link, node);
        node.parentElement!.removeChild(node);

        if (floatType === FloatType.Citation) {
            // Wrap with `[...]`
            link.insertAdjacentText('beforebegin', '[');
            link.insertAdjacentText('afterend', ']');
        }

        // Update the link to a surrogate if sidenoting is enabled for this
        // element.
        // This doesn't happen for citations because citations may have
        // multiple surrogates thus we can't decide which one to link.
        if (sidenote && floatType !== FloatType.Citation) {
            // Link to the sidenote version on a large screen
            const link2 = link.cloneNode(true) as HTMLAnchorElement;
            link2.href = '#' + encodeURIComponent('sidenote.' + target);
            link.parentElement!.insertBefore(link2, link);

            link.classList.add('hide-sidenote');
            link2.classList.add('only-sidenote');
        }

        return false;
    });

    // Add ARIA attributes
    forEachNodePreorder(node, n => {
        if (!isElement(n)) {
            return;
        }
        switch (n.tagName) {
            case TagNames.Figure:
                n.setAttribute('role', 'figure');
                {
                    let label = n.querySelector(ViewTagNames.FloatingElementLabel);
                    if (label) {
                        if (!label.id) {
                            label.id = makeNonce();
                        }
                        n.setAttribute('aria-labelledby', label.id);
                    }
                }
                {
                    let caption = n.querySelector(TagNames.FigureCaption);
                    if (caption) {
                        if (!caption.id) {
                            caption.id = makeNonce();
                        }
                        n.setAttribute('aria-describedby', caption.id);
                    }
                }
                break;
            case TagNames.Note:
                n.setAttribute('role', 'note');
                {
                    let label = n.querySelector(ViewTagNames.FloatingElementLabel);
                    if (label) {
                        if (!label.id) {
                            label.id = makeNonce();
                        }
                        n.setAttribute('aria-labelledby', label.id);
                    }
                }
                break;
            case TagNames.Error:
                n.setAttribute('role', 'group');
                break;
            case TagNames.Diagram:
                n.setAttribute('role', 'img');
                break;
            case TagNames.CodeBlock:
            case TagNames.Code:
                n.setAttribute('role', 'group');
                break;
            case TagNames.Admonition:
                n.setAttribute('role', 'group');
                {
                    let label = n.querySelector(TagNames.AdmonitionTitle);
                    if (label) {
                        if (!label.id) {
                            label.id = makeNonce();
                        }
                        n.setAttribute('aria-labelledby', label.id);
                    }
                }
                break;
            case TagNames.Title:
                n.setAttribute('role', 'heading');
                n.setAttribute('aria-level', '1');
                if (!n.id) {
                    n.id = makeNonce();
                }
                node.setAttribute('aria-labelledby', n.id);
                break;
            case 'h1':  case 'h2':  case 'h3':  case 'h4':  case 'h5':
            case 'h6':  case 'h7':  case 'h8':  case 'h9':
                n.setAttribute('aria-level', `${parseInt(n.tagName.substr(1), 10) + 1}`);
                break;
        }
    });
    node.setAttribute('role', 'document');

    // Wrap `<table>` with a `<div>` to display a horizontal scrollbar
    // as needed
    forEachNodePreorder(node, node => {
        if (isElement(node) && node.tagName === 'table') {
            const wrapper = node.ownerDocument!.createElement('div');
            wrapper.className = 'tableWrapper';
            node.parentElement!.insertBefore(wrapper, node);
            wrapper.appendChild(node);
        }
        return true;
    });

    // Render complex elements
    const promises: PromiseLike<void>[] = [];
    forEachNodePreorder(node, node => {
        if (isElement(node)) {
            const tagName = node.tagName.toLowerCase();
            if (HANDLERS.hasOwnProperty(tagName)) {
                const promise = HANDLERS[tagName](node, config, ctx);
                if (promise) {
                    promises.push(promise);
                }
                return false;
            }
        }
        return true;
    });

    return Promise.all(promises).then(() => {});
}

/**
 * Insert a phrasing content to an appropriate location inside `container` so
 * that it looks seamlessly prepended to the first text content of `container`.
 *
 * Consider the following example of `container`:
 *
 *     <div>
 *     <p>para</p>
 *     </div>
 *
 * In this case, `e` would be inserted just before the text node `para`.
 */
function prependPhrasingContent(e: Element, container: Element): void {
    let child: Node | null = container.firstChild;

    // Skip whitespaces
    while (child && isText(child) && /^\s*$/.test(child.textContent!)) {
        child = child.nextSibling;
    }

    // Descend into a `<p>`?
    if (isElement(child) && child.tagName === 'p') {
        return prependPhrasingContent(e, child);
    }

    container.insertBefore(e, child);
}

const katexInlineOptions = {
    // These macros are defined by Markdeep
    macros: {
        '\\n': '\\hat{n}',
        '\\w': '{\\hat{\\omega}}',
        '\\wi': '{\\w_\\mathrm{i}}',
        '\\wo': '{\\w_\\mathrm{o}}',
        '\\wh': '{\\w_\\mathrm{h}}',
        '\\Li': '{L_\\mathrm{i}}',
        '\\Lo': '{L_\\mathrm{o}}',
        '\\Le': '{L_\\mathrm{e}}',
        '\\Lr': '{L_\\mathrm{r}}',
        '\\Lt': '{L_\\mathrm{t}}',
        '\\O': '{\\mathrm{O}}',
        '\\degrees': '{{^{\\large\\circ}}}',
        '\\T': '{\\mathsf{T}}',
        '\\mathset': '[1]{\\mathbb{#1}}',
        '\\Real': '{\\mathset{R}}',
        '\\Integer': '{\\mathset{Z}}',
        '\\Boolean': '{\\mathset{B}}',
        '\\Complex': '{\\mathset{C}}',
    },
    throwOnError: false,
} as katex.KatexOptions;
const katexDisplayOptions: katex.KatexOptions = {
    displayMode: true,
    ... katexInlineOptions,
};

const KATEX_ENTITY_TABLE: ReadonlyArray<[string, string]> = [
    ['VeryThinSpace', '\u200a'],
    ['ThinSpace', '\u2009'],
    ['MediumSpace', '\u205f'],
    ['ThickSpace', '\u205f\u200a'],
    ['NegativeVeryThinSpace', '\u200b'],
    ['NegativeThinSpace', '\u200b'],
    ['NegativeMediumSpace', '\u200b'],
    ['NegativeThickSpace', '\u200b'],
];
const KATEX_ENTITY_TABLE_MAP = new Map(KATEX_ENTITY_TABLE);
const KATEX_ENTITY_REGEX = new RegExp(
    '&(' + KATEX_ENTITY_TABLE.map(pair => pair[0]).join('|') + ');', 'g');

/**
 * KaTeX generates entity references defined in HTML but not in XHTML.
 * This function replaces such entity references. It also adds `xmlns` to inline
 * SVG images to use the correct XML namespace.
 */
function xhtmlifyKatexOutput(html: string): string {
    return html.replace(KATEX_ENTITY_REGEX, (_, name) => KATEX_ENTITY_TABLE_MAP.get(name)!)
        .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
}

const HANDLERS: { [tagName: string]: (node: Element, vc: ViewerConfig, ctx: Context) => void | PromiseLike<void> } & Object = {
    [TagNames.Equation]: async (node) => {
        node.innerHTML = xhtmlifyKatexOutput(
            Katex.renderToString(node.textContent || '', katexInlineOptions));
    },
    [TagNames.DisplayEquation]: async (node) => {
        node.innerHTML = xhtmlifyKatexOutput(
            Katex.renderToString(node.textContent || '', katexDisplayOptions));
    },
    [TagNames.Code]: async (node) => {
        // Wrap it with `<pre>` so that it's formatted properly on Safari's
        // Reader View.
        const pre = node.ownerDocument!.createElement('pre');
        node.parentElement!.insertBefore(pre, node);
        pre.appendChild(node);

        const type = (node.getAttribute(AttributeNames.CodeType) || '').split(' ');
        const lang = type[0];
        if (lang !== '') {
            const highlighted = Hljs.highlightAuto(node.textContent || '', [lang]);
            node.innerHTML = highlighted.value;
        }

        // Insert line markers to accomplish various things
        node.insertAdjacentHTML('afterbegin', `<${ViewTagNames.CodeLineHead}/>`);
        transformTextNodeWith(
            node,
            html => html.replace(/\n/g, `\n<${ViewTagNames.CodeLineHead}/>`),
            e => true,
            false,
        );

        // Wrap entire the content with a `span`. With `box-decoration-break: clone`,
        // `span` is chop into physical lines, allowing us to display a line break
        // marker on each physical line.
        const spanWrap = node.ownerDocument!.createElement('span');
        while (node.firstChild) {
            spanWrap.appendChild(node.firstChild);
        }
        node.appendChild(spanWrap);

        // TODO: line numbers
    },
    [TagNames.Diagram]: async (node) => {
        // const diagram = await lazyModules.diagram();
        const svgCode = await toSvg(node.textContent!);
        node.innerHTML = svgCode;

        // Make the SVG image responsive
        const svg = node.firstElementChild as SVGSVGElement;
        const width = parseFloat(svg.getAttribute('width')!);
        const height = parseFloat(svg.getAttribute('height')!);

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.removeAttribute('width');
        svg.removeAttribute('height');

        const inner = node.ownerDocument!.createElement(ViewTagNames.DiagramInner);
        inner.appendChild(svg);
        node.appendChild(inner);

        node.classList.add('loaded');

        inner.style.maxWidth = `${width}px`;
    },
    [TagNames.Media]: (node, config, ctx) => processMediaElement(node, config, ctx),
};
