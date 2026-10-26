// Motion observed on the public reference: 250ms card entry, 700ms choice
// reveal, 400ms record highlight. Transitions never advance the life clock.
const entrances = new WeakMap();
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function clearDecisionEntrance(dialog) {
  const entrance = entrances.get(dialog);
  if (entrance) {
    clearTimeout(entrance.timer);
    entrance.animations.forEach(a => a.cancel());
  }
  entrances.delete(dialog);
  dialog.querySelector('.choices')?.removeAttribute('aria-busy');
}

export function decisionCanChoose(dialog) {
  const entrance = entrances.get(dialog);
  return !entrance || performance.now() >= entrance.readyAt;
}

export function revealDecision(dialog, key, reopening) {
  const previous = entrances.get(dialog);
  // Changing auto mode on an open card keeps its original reveal position.
  if (reopening || previous?.key !== key) clearDecisionEntrance(dialog);
  const elapsed = !reopening && previous?.key === key
    ? performance.now() - previous.startedAt : 0;
  const duration = reducedMotion() ? 0 : 700;
  const startedAt = performance.now() - elapsed;
  const entrance = {key, startedAt, readyAt:startedAt + duration, animations:[], timer:null};
  if (previous?.key === key && !reopening) {
    clearTimeout(previous.timer);
    previous.animations.forEach(a => a.cancel());
  }
  entrances.set(dialog, entrance);
  const choices = dialog.querySelector('.choices');
  const remaining = Math.max(0, entrance.readyAt - performance.now());
  choices.setAttribute('aria-busy', String(remaining > 0));
  if (duration && elapsed < 250) {
    const card = dialog.animate([
      {opacity:.6, transform:'translateY(8px)'},
      {opacity:1, transform:'none'},
    ], {duration:250, easing:'ease'});
    card.id = 'decision-draw'; card.currentTime = elapsed;
    entrance.animations.push(card);
  }
  if (remaining) {
    const options = choices.animate([{opacity:.45}, {opacity:1}],
      {duration:700, easing:'ease-out', fill:'both'});
    options.id = 'choice-reveal'; options.currentTime = elapsed;
    entrance.animations.push(options);
    entrance.timer = setTimeout(() => {
      if (entrances.get(dialog) === entrance && dialog.open)
        choices.setAttribute('aria-busy', 'false');
    }, remaining);
  }
}

function highlight(row) {
  if (reducedMotion()) return;
  row.classList.add('event-arriving');
  setTimeout(() => row.classList.remove('event-arriving'), 400);
}

export function reconcileTimeline(timeline, next) {
  const old = new Map([...timeline.children].map(row => [row.dataset.eventid, row]));
  let previous = null;
  for (const row of [...next.children]) {
    const item = old.get(row.dataset.eventid) || row;
    if (!old.has(row.dataset.eventid)) highlight(item);
    else {
      item.setAttribute('aria-expanded', row.getAttribute('aria-expanded'));
      const text = item.querySelector('p'), updatedText = row.querySelector('p');
      if (text.textContent !== updatedText.textContent) text.textContent = updatedText.textContent;
      const star = item.querySelector('[data-star]'), updated = row.querySelector('[data-star]');
      for (const name of ['aria-pressed', 'aria-label']) star.setAttribute(name, updated.getAttribute(name));
      star.textContent = updated.textContent;
    }
    const position = previous ? previous.nextElementSibling : timeline.firstElementChild;
    if (item !== position) timeline.insertBefore(item, position);
    old.delete(row.dataset.eventid); previous = item;
  }
  for (const row of old.values()) row.remove();
}

function replaceSection(root, next, selector) {
  const old = root.querySelector(selector), updated = next.querySelector(selector);
  if (!old || !updated || old.outerHTML === updated.outerHTML) return;
  const openDetails = new Set([...old.querySelectorAll('details[open]')]
    .map(el => el.querySelector('summary')?.textContent));
  for (const detail of updated.querySelectorAll('details')) {
    if (openDetails.has(detail.querySelector('summary')?.textContent)) detail.open = true;
  }
  old.replaceWith(updated);
}

function reconcileScene(root, next) {
  const current = root.querySelector('.scene-card'), updated = next.querySelector('.scene-card');
  const old = current.querySelector('.life-scene:not(.scene-outgoing)');
  const image = updated.querySelector('.life-scene');
  if (old.innerHTML === image.innerHTML) {
    old.setAttribute('aria-label', image.getAttribute('aria-label'));
  } else {
    current.querySelector('.scene-outgoing')?.remove();
    old.replaceWith(image);
    if (!reducedMotion()) {
      old.classList.add('scene-outgoing'); old.setAttribute('aria-hidden', 'true');
      current.prepend(old);
      const fade = old.animate([{opacity:1}, {opacity:0}], {duration:250, easing:'ease'});
      image.animate([{opacity:0}, {opacity:1}], {duration:250, easing:'ease'});
      fade.finished.then(() => old.remove(), () => old.remove());
    }
  }
  const caption = current.querySelector('.scene-caption'), nextCaption = updated.querySelector('.scene-caption');
  if (caption.outerHTML !== nextCaption.outerHTML) caption.replaceWith(nextCaption);
}

export function patchGame(root, markup, lifeId) {
  const next = document.createElement('template'); next.innerHTML = markup;
  if (root.dataset.lifeId !== lifeId || !root.querySelector('.timeline')) {
    root.dataset.lifeId = lifeId;
    root.replaceChildren(next.content);
    return;
  }
  const widths = new Map([...root.querySelectorAll('.stat-track i')]
    .map(bar => [bar.closest('.compact-stats') ? 'compact:' + bar.parentElement.className
      : 'full:' + bar.parentElement.className, bar.style.width]));
  // Keep the story column and its rows mounted across years and choices. A full
  // innerHTML replacement would cut off an entry animation and lose focus.
  reconcileTimeline(root.querySelector('.timeline'), next.content.querySelector('.timeline'));
  reconcileScene(root, next.content);
  for (const selector of ['.game-toolbar', '.identity-card', '.profile-card',
    '.compact-stats', '.focus-box', '.game-insights']) replaceSection(root, next.content, selector);
  for (const selector of ['.pending-banner', '.timeline-more']) {
    const old = root.querySelector(selector), updated = next.content.querySelector(selector);
    if (old?.outerHTML === updated?.outerHTML) continue;
    if (old && updated) old.replaceWith(updated);
    else if (old) old.remove();
    else if (updated) {
      const story = root.querySelector('.story-column');
      if (selector === '.pending-banner') story.prepend(updated); else story.append(updated);
    }
  }
  if (!reducedMotion()) for (const bar of root.querySelectorAll('.stat-track i')) {
    const key = (bar.closest('.compact-stats') ? 'compact:' : 'full:') + bar.parentElement.className;
    const old = widths.get(key);
    if (old && old !== bar.style.width)
      bar.animate([{width:old}, {width:bar.style.width}], {duration:400, easing:'ease'});
  }
}
