import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

document.querySelector('.projects-title').textContent =
  `Projects (${projects.length})`;

const rolledData = d3.rollups(
  projects,
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

const sliceGenerator = d3.pie().value((d) => d.value);
const arcData = sliceGenerator(data);

const arcs = arcData.map((slice) => arcGenerator(slice));
const colors = d3.scaleOrdinal(d3.schemeTableau10);

arcs.forEach((arc, index) => {
  d3.select('#projects-plot')
    .append('path')
    .attr('d', arc)
    .attr('fill', colors(index));
});

const legend = d3.select('.legend');

data.forEach((d, index) => {
  legend.append('li')
    .attr('class', 'legend-item')
    .attr('style', `--color: ${colors(index)}`)
    .html(`
      <span class="swatch"></span>
      ${d.label} <em>(${d.value})</em>
    `);
});

let query = '';

const searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  query = event.target.value.toLowerCase();

  const filteredProjects = projects.filter((project) =>
    Object.values(project)
      .join(' ')
      .toLowerCase()
      .includes(query)
  );

  renderProjects(filteredProjects, projectsContainer, 'h2');

  document.querySelector('.projects-title').textContent =
    `Projects (${filteredProjects.length})`;
});