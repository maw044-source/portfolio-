import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');

const colors = d3.scaleOrdinal(d3.schemeTableau10)
  .domain([...new Set(projects.map((project) => String(project.year)))]);

let query = '';
let selectedIndex = -1;
function renderPieChart(projectsToShow) {
  d3.select('#projects-plot').selectAll('*').remove();
  d3.select('.legend').selectAll('*').remove();

  const rolledData = d3.rollups(
    projectsToShow,
    (group) => group.length,
    (project) => project.year,
  );

  const data = rolledData.map(([year, count]) => ({
    value: count,
    label: String(year),
  }));

  const arcGenerator = d3.arc()
    .innerRadius(0)
    .outerRadius(50);

  const sliceGenerator = d3.pie()
    .value((d) => d.value);

  const arcData = sliceGenerator(data);

  arcs.forEach((arc, index) => {
  d3.select('#projects-plot')
    .append('path')
    .attr('d', arc)
    .attr('fill', colors(index))
    .classed('selected', index === selectedIndex)
    .on('click', () => {
      const selectedYear =
  selectedIndex === -1 ? null : data[selectedIndex].label;

const filteredProjects = projects.filter((project) => {
  const matchesSearch = Object.values(project)
    .join(' ')
    .toLowerCase()
    .includes(query);

  const matchesYear =
    selectedYear === null || String(project.year) === selectedYear;

  return matchesSearch && matchesYear;
});

renderProjects(filteredProjects, projectsContainer, 'h2');

document.querySelector('.projects-title').textContent =
  `Projects (${filteredProjects.length})`;
      selectedIndex = selectedIndex === index ? -1 : index;

      d3.select('#projects-plot')
        .selectAll('path')
        .classed('selected', (_, i) => i === selectedIndex);

      d3.select('.legend')
        .selectAll('li')
        .classed('selected', (_, i) => i === selectedIndex);
    });
});

  const legend = d3.select('.legend');

  data.forEach((d) => {
    legend.append('li')
      .attr('class', 'legend-item')
      .classed('selected', index === selectedIndex)
      .attr('style', `--color: ${colors(d.label)}`)
      .html(`
        <span class="swatch"></span>
        ${d.label} <em>(${d.value})</em>
      `);
  });
}

function updateProjects() {
  const filteredProjects = projects.filter((project) =>
    Object.values(project)
      .join(' ')
      .toLowerCase()
      .includes(query)
  );

  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects);

  document.querySelector('.projects-title').textContent =
    `Projects (${filteredProjects.length})`;
}

searchInput.addEventListener('input', (event) => {
  query = event.target.value.toLowerCase();
  updateProjects();
});

updateProjects();
