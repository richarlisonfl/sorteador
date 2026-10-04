const teams = [
  { name: 'Equipe 1', classes: ['Turma 1', 'Turma 2', 'Turma 3', 'Turma 4'] },
  { name: 'Equipe 2', classes: ['Turma 5', 'Turma 6', 'Turma 7', 'Turma 8'] },
  { name: 'Equipe 3', classes: ['Turma 9', 'Turma 10', 'Turma 11', 'Turma 12'] },
  { name: 'Equipe 4', classes: ['Turma 13', 'Turma 14', 'Turma 15', 'Turma 16'] },
  { name: 'Equipe 5', classes: ['Turma 17', 'Turma 18', 'Turma 19', 'Turma 20'] },
  { name: 'Equipe 6', classes: ['Turma 21', 'Turma 22', 'Turma 23', 'Turma 24'] }
];

const header = document.querySelector('#teams-header');
const body = document.querySelector('#teams-body');
const rowCount = Math.max(...teams.map((team) => team.classes.length));

teams.forEach((team) => {
  const cell = document.createElement('th');
  cell.scope = 'col';
  cell.textContent = team.name;
  header.append(cell);
});

for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
  const row = document.createElement('tr');

  teams.forEach((team) => {
    const cell = document.createElement('td');
    cell.textContent = team.classes[rowIndex] ?? '';
    row.append(cell);
  });

  body.append(row);
}

const totalClasses = teams.reduce((total, team) => total + team.classes.length, 0);
document.querySelector('#team-count').textContent = `${teams.length} equipes · ${totalClasses} turmas`;

const status = document.querySelector('#draw-status');
document.querySelector('#draw-all').addEventListener('click', () => {
  status.textContent = 'A lógica do sorteio será definida na próxima etapa.';
});
document.querySelector('#draw-one').addEventListener('click', () => {
  status.textContent = 'A lógica do sorteio será definida na próxima etapa.';
});