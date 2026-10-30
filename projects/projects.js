import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');

const years = [
  ...new Set(projects.map((project) => String(project.year))),
];

const colors = d3.scaleOrdinal(d3.schemeTableau10)
  .domain(years);

let query = '';
let selectedYear = null;

function renderPieChart(projectsToShow) {
  const svg = d3.select('#projects-plot');
  const legend = d3.select('.legend');

  svg.selectAll('*').remove();
  legend.selectAll('*').remove();

  const rolledData = d3.rollups(
    projectsToShow,
    (group) => group.length,
    (project) => String(project.year),
  );

  const data = rolledData.map(([year, count]) => ({
    label: year,
    value: count,
  }));

  const arcGenerator = d3.arc()
    .innerRadius(0)
    .outerRadius(50);

  const sliceGenerator = d3.pie()
    .value((d) => d.value);

  const slices = sliceGenerator(data);

  slices.forEach((slice) => {
    const year = slice.data.label;

    svg.append('path')
      .attr('d', arcGenerator(slice))
      .attr('fill', colors(year))
      .classed('selected', year === selectedYear)
      .on('click', () => {
        selectedYear = selectedYear === year ? null : year;
        updateProjects();
      });
  });

  data.forEach((d) => {
    legend.append('li')
      .attr('class', 'legend-item')
      .classed('selected', d.label === selectedYear)
      .attr('style', `--color: ${colors(d.label)}`)
      .html(`
        <span class="swatch"></span>
        ${d.label} <em>(${d.value})</em>
      `);
  });
}

function updateProjects() {
  const searchResults = projects.filter((project) =>
    Object.values(project)
      .join(' ')
      .toLowerCase()
      .includes(query)
  );

  const filteredProjects = searchResults.filter((project) =>
    selectedYear === null ||
    String(project.year) === selectedYear
  );

  renderProjects(filteredProjects, projectsContainer, 'h2');

  // Show the search results by year, keeping slices available.
  renderPieChart(searchResults);

  document.querySelector('.projects-title').textContent =
    `Projects (${filteredProjects.length})`;
}

searchInput.addEventListener('input', (event) => {
  query = event.target.value.toLowerCase();
  updateProjects();
});

updateProjects();
