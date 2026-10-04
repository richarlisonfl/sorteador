const STORAGE_KEY = 'sorteador-config-v1';
const CLASS_PATTERN = /^(\d+)([A-Za-zÀ-ÿ]+)-([A-Za-z])$/;
const TBD = 'A definir';

const DEFAULT_CONFIG = {
  classes: ['INF', 'MAB', 'ADM'].flatMap((course) =>
    ['A', 'B'].flatMap((shift) => [1, 2, 3].map((year) => `${year}${course}-${shift}`))
  ),
  extra: []
};

const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const loadConfig = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.classes) && Array.isArray(saved.extra)) return saved;
  } catch {
    // configuração inválida: usa o padrão
  }
  return structuredClone(DEFAULT_CONFIG);
};

const parseLines = (text) =>
  text.split('\n').map((line) => line.trim()).filter(Boolean);

const parseClass = (name) => {
  const match = CLASS_PATTERN.exec(name);
  if (!match) return null;
  return { name, year: Number(match[1]), course: match[2].toUpperCase(), shift: match[3].toUpperCase() };
};

// Distribui as turmas de cada ano entre as equipes sem repetir curso na mesma equipe.
const fillTeams = (years, classesByYear, teamCount) => {
  const teams = Array.from({ length: teamCount }, () => ({}));

  const place = (yearIndex) => {
    if (yearIndex === years.length) return true;
    const year = years[yearIndex];
    const pool = shuffle(classesByYear.get(year) ?? []);

    const assign = (teamIndex, remaining) => {
      if (teamIndex === teamCount) return place(yearIndex + 1);
      const options = remaining.filter(
        (item) => !Object.values(teams[teamIndex]).some((used) => used.course === item.course)
      );
      const candidates = remaining.length <= teamCount - teamIndex - 1 ? [...options, null] : options;
      for (const choice of shuffle(candidates)) {
        if (choice) teams[teamIndex][year] = choice;
        const rest = choice ? remaining.filter((item) => item !== choice) : remaining;
        if (assign(teamIndex + 1, rest)) return true;
        delete teams[teamIndex][year];
      }
      return false;
    };

    return assign(0, pool);
  };

  return place(0) ? teams : null;
};

const buildTeams = (config) => {
  const parsed = config.classes.map(parseClass);
  const classes = parsed.filter(Boolean);
  const years = [...new Set(classes.map((item) => item.year))].sort((a, b) => b - a);
  const shifts = [...new Set(classes.map((item) => item.shift))].sort();
  const result = [];

  shifts.forEach((shift) => {
    const inShift = classes.filter((item) => item.shift === shift);
    const byCourse = new Map();
    inShift.forEach((item) => byCourse.set(item.course, [...(byCourse.get(item.course) ?? []), item]));

    const solo = [];
    const regular = [];
    byCourse.forEach((items) => (items.length === 1 ? solo : regular).push(...items));

    const classesByYear = new Map();
    regular.forEach((item) => classesByYear.set(item.year, [...(classesByYear.get(item.year) ?? []), item]));
    const teamCount = Math.max(0, ...[...classesByYear.values()].map((items) => items.length));

    if (teamCount > 0) {
      const filled = fillTeams(years, classesByYear, teamCount);
      if (!filled) throw new Error(`Não foi possível montar equipes válidas no turno ${shift}. Revise as turmas.`);
      filled.forEach((slots) => result.push({ shift, slots: Object.fromEntries(Object.entries(slots).map(([y, c]) => [y, c.name])) }));
    }

    solo.forEach((item) => result.push({ shift, slots: { [item.year]: item.name } }));
  });

  config.extra.forEach((name) => result.push({ shift: null, slots: { [years[years.length - 1] ?? 1]: name }, fixed: true }));

  return { years, teams: result };
};

const header = document.querySelector('#teams-header');
const body = document.querySelector('#teams-body');
const status = document.querySelector('#draw-status');
const teamCount = document.querySelector('#team-count');

let config = loadConfig();
let layout = null;
let revealed = 0;

const shiftLabel = (shift) => (shift ? `Turno ${shift}` : 'Fora do sorteio');

const render = () => {
  const { years, teams } = layout;
  header.replaceChildren();
  body.replaceChildren();

  const corner = document.createElement('th');
  corner.scope = 'col';
  corner.className = 'row-label';
  corner.textContent = 'Ano';
  header.append(corner);

  teams.forEach((team, index) => {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.append(`Equipe ${index + 1}`);
    const small = document.createElement('small');
    small.textContent = shiftLabel(team.shift);
    cell.append(small);
    header.append(cell);
  });

  const rows = years.length ? years : [1];
  rows.forEach((year) => {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    label.className = 'row-label';
    label.textContent = `${year}º ano`;
    row.append(label);

    teams.forEach((team, index) => {
      const cell = document.createElement('td');
      if (index >= revealed) {
        cell.textContent = '—';
        cell.className = 'pending';
      } else if (team.slots[year]) {
        cell.textContent = team.slots[year];
      } else {
        cell.textContent = TBD;
        cell.className = 'placeholder';
      }
      row.append(cell);
    });
    body.append(row);
  });

  const totalClasses = teams.reduce((total, team) => total + Object.keys(team.slots).length, 0);
  teamCount.textContent = `${teams.length} equipes · ${totalClasses} turmas`;
};

const draw = () => {
  try {
    layout = buildTeams(config);
    return true;
  } catch (error) {
    status.textContent = error.message;
    return false;
  }
};

const reset = () => {
  revealed = 0;
  if (draw()) {
    status.textContent = '';
    render();
  }
};

document.querySelector('#draw-all').addEventListener('click', () => {
  if (!draw()) return;
  revealed = layout.teams.length;
  status.textContent = 'Sorteio concluído.';
  render();
});

document.querySelector('#draw-one').addEventListener('click', () => {
  if (!layout || revealed === 0 || revealed >= layout.teams.length) {
    if (!draw()) return;
    revealed = 0;
  }
  revealed += 1;
  status.textContent = revealed === layout.teams.length
    ? 'Sorteio concluído.'
    : `Equipe ${revealed} sorteada. Clique novamente para a próxima.`;
  render();
});

const dialog = document.querySelector('#settings-dialog');
const classesField = document.querySelector('#cfg-classes');
const extraField = document.querySelector('#cfg-extra');
const errorBox = document.querySelector('#settings-error');

const fillForm = (source) => {
  classesField.value = source.classes.join('\n');
  extraField.value = source.extra.join('\n');
  errorBox.textContent = '';
};

document.querySelector('#open-settings').addEventListener('click', () => {
  fillForm(config);
  dialog.showModal();
});
document.querySelector('#settings-cancel').addEventListener('click', () => dialog.close());
document.querySelector('#settings-reset').addEventListener('click', () => fillForm(DEFAULT_CONFIG));

document.querySelector('#settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const classes = parseLines(classesField.value);
  const extra = parseLines(extraField.value);
  const invalid = classes.filter((name) => !parseClass(name));
  const all = [...classes, ...extra].map((name) => name.toUpperCase());
  const duplicated = all.filter((name, index) => all.indexOf(name) !== index);
  const problems = [];

  if (!classes.length) problems.push('Informe ao menos uma turma.');
  if (invalid.length) problems.push(`Formato inválido: ${invalid.join(', ')}`);
  if (duplicated.length) problems.push(`Turmas repetidas: ${[...new Set(duplicated)].join(', ')}`);

  if (!problems.length) {
    try {
      buildTeams({ classes, extra });
    } catch (error) {
      problems.push(error.message);
    }
  }

  if (problems.length) {
    errorBox.textContent = problems.join('\n');
    return;
  }

  config = { classes: classes.map((name) => name.toUpperCase()), extra };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  dialog.close();
  reset();
});

reset();
