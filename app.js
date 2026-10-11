const $ = (id) => document.getElementById(id);
const groupsEl = $('groups');
const STORAGE_KEY = 'etler-trait-farm-config-v1';

const initialGroups = [
  { stands: 'Standless', traits: 'Any Hexed, All Mythic', farmWith: '', ucoins: '', floor: '' },
];

function makeInput(label, key, value, placeholder = '', type = 'text', note = '') {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const title = document.createElement('span');
  title.textContent = label;
  if (note) {
    const small = document.createElement('small');
    small.textContent = note;
    title.append(' ', small);
  }
  const input = document.createElement('input');
  input.type = type;
  input.dataset.key = key;
  input.value = value;
  input.placeholder = placeholder;
  if (type === 'number') input.min = '0';
  wrapper.append(title, input);
  return wrapper;
}

function addGroup(data = { stands: '', traits: '', farmWith: '', ucoins: '', floor: '' }, afterCard = null) {
  const card = document.createElement('article');
  card.className = 'group';
  const top = document.createElement('div');
  top.className = 'group-top';
  const label = document.createElement('span');
  label.className = 'group-label';
  const actions = document.createElement('div');
  actions.className = 'group-actions';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'duplicate';
  copy.setAttribute('aria-label', 'Copy this stand group');
  copy.textContent = 'Copy';
  copy.addEventListener('click', () => {
    const values = Object.fromEntries([...card.querySelectorAll('input')].map(input => [input.dataset.key, input.value]));
    addGroup(values, card);
  });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove';
  remove.setAttribute('aria-label', 'Remove this stand group');
  remove.textContent = '×';
  remove.addEventListener('click', () => { card.remove(); refresh(); });
  actions.append(copy, remove);
  top.append(label, actions);

  const fields = document.createElement('div');
  fields.className = 'group-fields';
  fields.append(
    makeInput('Stands', 'stands', data.stands, 'e.g. The Vessel, Kuro Claws', 'text', 'Comma separated'),
    makeInput('Wanted traits', 'traits', data.traits, 'e.g. Godly, Any Hexed', 'text', 'Stops on first match'),
  );
  const extras = document.createElement('div');
  extras.className = 'group-extra-grid';
  extras.append(
    makeInput('Farm with trait', 'farmWith', data.farmWith, 'Optional · e.g. Economic Hexed'),
    makeInput('UCoins cap', 'ucoins', data.ucoins, 'Global default', 'number', '0 = no cap'),
    makeInput('Floor cap', 'floor', data.floor, 'Global default', 'number', '0 = climb forever'),
  );
  card.append(top, fields, extras);
  if (afterCard?.parentElement === groupsEl) groupsEl.insertBefore(card, afterCard.nextSibling);
  else groupsEl.append(card);
  card.querySelectorAll('input').forEach(input => input.addEventListener('input', refresh));
  refresh();
}

function splitList(value) {
  return value.split(',').map(x => x.trim()).filter(Boolean);
}
function luaString(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\r', '\\r')}"`;
}
function luaList(values) { return `{ ${values.map(luaString).join(', ')} }`; }
function numberValue(id, fallback = 0) {
  const value = Number($(id).value);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}
function bool(id) { return $(id).checked ? 'true' : 'false'; }
function groupRows() {
  return [...groupsEl.querySelectorAll('.group')].map(card => Object.fromEntries(
    [...card.querySelectorAll('input')].map(input => [input.dataset.key, input.value.trim()])
  ));
}
function readSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveState() {
  const fields = {};
  document.querySelectorAll('.settings-content input[id]').forEach(input => {
    fields[input.id] = input.type === 'checkbox' ? input.checked : input.value;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fields, groups: groupRows() }));
    $('save-status').textContent = 'Saved on this device';
  } catch {
    $('save-status').textContent = 'Auto-save unavailable';
  }
}
function luaGroup(group) {
  const lines = [
    `        { Stands = ${luaList(splitList(group.stands))}, Wanted_Traits = ${luaList(splitList(group.traits))},`,
    `          Farm_With_Trait = ${luaString(group.farmWith)}`,
  ];
  const overrides = [];
  if (group.ucoins !== '') overrides.push(`UCoins_Cap = ${Math.max(0, Math.floor(Number(group.ucoins) || 0))}`);
  if (group.floor !== '') overrides.push(`Floor_Cap = ${Math.max(0, Math.floor(Number(group.floor) || 0))}`);
  if (overrides.length) lines[1] += `, ${overrides.join(', ')}`;
  lines[1] += ' },';
  return lines.join('\n');
}
function generate() {
  const priorities = groupRows().map(luaGroup).join('\n');
  const items = luaList(splitList($('items').value));
  const skillKeys = luaList(splitList($('skill-keys').value));
  const rarities = luaList(splitList($('rarities').value));
  return `getgenv().Config = {\n\n    Stands_Swap_Priority = {\n${priorities || '        -- Add a stand group to get started'}\n    },\n\n    Floor_Cap = ${numberValue('floor-cap', 15)},\n    UCoins_Cap = ${numberValue('ucoins-cap')},\n    WebHook = ${luaString($('webhook').value.trim())},\n\n    ItemsToKeep = ${items},\n\n    Optimization = { Fps_Cap = ${numberValue('fps-cap', 15)}, Eco_Mode = ${bool('eco-mode')}, Stop_Rendering = ${bool('stop-rendering')}, Debug_Mode = ${bool('debug-mode')} },\n\n    Farming = { Auto_Chest = ${bool('auto-chest')}, Auto_Ascend = ${bool('auto-ascend')}, Ascension_Cap = ${numberValue('ascension-cap')}, Ascend_Cooldown = ${numberValue('ascend-cooldown')} },\n\n    Combat = { Auto_Summon_Stand = ${bool('auto-summon')}, Auto_Buso_Haki = ${bool('auto-buso')}, Auto_Skills = ${bool('auto-skills')}, Skill_Keys = ${skillKeys} },\n\n    Skins_Settings = {\n        Recycle = ${bool('skin-recycle')},\n        Keep_Rarities = ${rarities},\n        Keep_Premium = ${bool('keep-premium')},\n        Keep_Unusuals = ${bool('keep-unusuals')},\n        Forge_Unusuals = ${bool('forge-unusuals')},\n        Buy_Crates = ${bool('buy-crates')},\n        WebHook = ${luaString($('skin-webhook').value.trim())},\n    },\n}`;
}
function refresh() {
  [...groupsEl.querySelectorAll('.group')].forEach((card, index) => {
    card.querySelector('.group-label').textContent = `GROUP ${String(index + 1).padStart(2, '0')}`;
    card.querySelector('.remove').hidden = groupsEl.children.length === 1;
  });
  $('output').textContent = generate();
  saveState();
}

$('add-group').addEventListener('click', () => addGroup());
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(generate());
    $('copied').textContent = 'Copied to clipboard';
    $('copied').classList.add('show');
    setTimeout(() => $('copied').classList.remove('show'), 1800);
  } catch {
    $('copied').textContent = 'Select and copy the config';
    $('copied').classList.add('show');
    setTimeout(() => $('copied').classList.remove('show'), 1800);
  }
});

document.querySelectorAll('.settings-content input').forEach(input => input.addEventListener('input', refresh));
document.querySelectorAll('.settings-content input[type="checkbox"]').forEach(input => input.addEventListener('change', refresh));
const savedState = readSavedState();
if (savedState?.fields && typeof savedState.fields === 'object') {
  Object.entries(savedState.fields).forEach(([id, value]) => {
    const input = $(id);
    if (!input || input.type === 'button') return;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = String(value ?? '');
  });
}
const groupsToLoad = Array.isArray(savedState?.groups) && savedState.groups.length
  ? savedState.groups
  : initialGroups;
groupsToLoad.forEach(addGroup);
