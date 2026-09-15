/* ============================================================================
   edge-hit-proxies.js — make thin SVG diagram arrows SELECTABLE in edit mode.

   THE PROBLEM
   A diagram edge is usually a ~2px <path>/<line> with fill:none. The browser
   only hit-tests the painted stroke, so clicking it (in edit mode, or anywhere)
   means landing on a hair-thin line — practically impossible by hand. Worse, a
   perfectly straight vertical/horizontal edge has a ZERO-width (or zero-height)
   bounding box, so even the edit-mode highlight can't draw a visible rect for it
   and the user concludes "this arrow isn't selectable." (The edit-mode overlay
   already pads zero-dimension rects to a minimum so the *highlight* shows; this
   module fixes the *hit area* so the click actually lands.)

   THE FIX
   For each edge, add a transparent FAT-stroke "hit proxy" of the same geometry
   that carries the edge's data-viz-id, and move the id OFF the painted edge onto
   the proxy. Now hover/click resolves over a wide band while the visible arrow
   stays crisp. The proxy is inert until edit mode is on (see the CSS below), so
   it never disturbs normal page use, drill-node clicks, or pan/zoom.

   WIRING (one call per SVG you want selectable arrows in)
   - Main map (edges already carry their own data-viz-id):
       tagSvgEdges(document.querySelector('#archSvg g.edges'),
         { selector: 'path[data-viz-id], line[data-viz-id]', idAttr: 'data-viz-id', prefix: 'arch.edge' });
   - A diagram drawn at RUNTIME (drill modal pipeline, ERD lines) whose connectors
     have NO ids — synthesize stable ones. Call it AFTER each render (a fresh
     innerHTML wipes old proxies, so there is nothing to clean up):
       tagSvgEdges(stage.querySelector('.pl-svg'), { selector: 'path.pl-conn', prefix: 'drill.engine.edge' });
       tagSvgEdges(erdSvg,                          { selector: 'path.erd-line', prefix: 'erd.rel' });

   REQUIRED CSS (add to your page stylesheet — `body.em-active` is set by edit-mode):
     .edge-hit { stroke: transparent; stroke-width: 14; fill: none; pointer-events: none; }
     body.em-active .edge-hit { pointer-events: stroke; cursor: pointer; }
   Place each proxy layer INSIDE the same pan/zoom group as its edges (this module
   appends to `root`), so the proxies track zoom with the diagram.

   DEPENDENCIES: none. Pure DOM/SVG.
   ============================================================================ */

const NS_SVG = 'http://www.w3.org/2000/svg';

/**
 * @param {Element} root     the SVG group/element whose connectors to proxy
 * @param {object}  opts
 * @param {string}  opts.selector  CSS selector for the connector paths/lines
 * @param {string}  opts.prefix    id prefix for synthesized ids (`${prefix}.1`, …)
 * @param {string} [opts.idAttr]   if set, reuse this attribute's value as the id
 *                                  (e.g. 'data-viz-id' when edges already carry one)
 */
export function tagSvgEdges(root, { selector, prefix, idAttr } = {}) {
  if (!root) return;
  const conns = [...root.querySelectorAll(selector)];
  if (!conns.length) return;

  // a hit-proxy layer appended last so it wins hit-testing over the painted lines
  const hits = document.createElementNS(NS_SVG, 'g');
  hits.setAttribute('class', 'edge-hits');
  hits.setAttribute('fill', 'none');

  let auto = 0;
  conns.forEach((edge) => {
    const isPath = edge.tagName.toLowerCase() === 'path';
    // build a proxy of the same shape (path uses d; line uses x1/y1/x2/y2)
    const proxy = document.createElementNS(NS_SVG, isPath ? 'path' : 'line');
    if (isPath) {
      proxy.setAttribute('d', edge.getAttribute('d') || '');
    } else {
      ['x1', 'y1', 'x2', 'y2'].forEach((a) => proxy.setAttribute(a, edge.getAttribute(a) || '0'));
    }
    proxy.setAttribute('class', 'edge-hit');
    // id: reuse the edge's own (idAttr) if present, else synthesize a stable one
    const id = (idAttr && edge.getAttribute(idAttr)) || `${prefix}.${++auto}`;
    proxy.setAttribute('data-viz-id', id);
    const lbl = edge.getAttribute('data-viz-label');
    proxy.setAttribute('data-viz-label', lbl || id.split('.').pop());
    // move the id off the painted edge so edit-mode resolves the (wide) proxy
    edge.removeAttribute('data-viz-id');
    edge.removeAttribute('data-viz-label');
    hits.appendChild(proxy);
  });

  root.appendChild(hits);
}
