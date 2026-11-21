import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3/+esm';
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
    const first = lines[0];

    const result = {
      id: commit,
      author: first.author,
      date: first.date,
      time: first.time,
      timezone: first.timezone,
      datetime: first.datetime,
      hourFrac:
        first.datetime.getHours() + first.datetime.getMinutes() / 60,
      totalLines: lines.length,
    };

    Object.defineProperty(result, 'lines', {
      value: lines,
      enumerable: false,
    });

    return result;
  });
}

function renderCommitInfo(data, commits) {
  const container = d3.select('#stats');
  container.selectAll('*').remove();

  const dl = container.append('dl').attr('class', 'stats');

  const stats = [
    ['Total lines of code', data.length],
    ['Total commits', commits.length],
    ['Number of files', d3.group(data, (d) => d.file).size],
    ['Average line length', d3.mean(data, (d) => d.length).toFixed(1)],
    ['Longest line', d3.max(data, (d) => d.length)],
    ['Maximum depth', d3.max(data, (d) => d.depth)],
  ];

  for (const [label, value] of stats) {
    const item = dl.append('div');
    item.append('dt').text(label);
    item.append('dd').text(value);
  }
}

function updateTooltipContent(commit) {
  const link = document.querySelector('#commit-link');

  link.href =
    'https://github.com/maw044-source/portfolio-/commit/' + commit.id;
  link.textContent = commit.id;

  document.querySelector('#commit-date').textContent =
    commit.datetime.toLocaleDateString();

  document.querySelector('#commit-time').textContent =
    commit.datetime.toLocaleTimeString();

  document.querySelector('#commit-author').textContent = commit.author;
  document.querySelector('#commit-lines').textContent = commit.totalLines;
}

function updateTooltipPosition(event) {
  const tooltip = document.querySelector('#commit-tooltip');

  // Keep the tooltip inside the browser window.
  const left = Math.max(
    8,
    Math.min(event.clientX + 15, window.innerWidth - tooltip.offsetWidth - 8)
  );

  const top = Math.max(
    8,
    Math.min(event.clientY + 15, window.innerHeight - tooltip.offsetHeight - 8)
  );

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function updateLanguageBreakdown(selectedCommits) {
  const container = d3.select('#language-breakdown');
  container.selectAll('*').remove();

  if (selectedCommits.length === 0) {
    return;
  }

  const lines = selectedCommits.flatMap((commit) => commit.lines);

  const breakdown = d3.rollups(
    lines,
    (group) => group.length,
    (line) => line.type
  ).sort((a, b) => b[1] - a[1]);

  for (const [language, count] of breakdown) {
    container.append('dt').text(language.toUpperCase());

    container.append('dd').text(
      `${count} lines (${d3.format('.1%')(count / lines.length)})`
    );
  }
}

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;

  const margin = { top: 20, right: 20, bottom: 40, left: 60 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  d3.select('#chart').selectAll('*').remove();

  const svg = d3.select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // Convert dates into horizontal positions.
  const xScale = d3.scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  // Convert hours into vertical positions.
  const yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Draw faint horizontal grid lines.
  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(
      d3.axisLeft(yScale)
        .tickFormat('')
        .tickSize(-usableArea.width)
    );

  // Draw the time-of-day axis.
  svg.append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(
      d3.axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00')
    );

  svg.append('g')
  .attr('class', 'x-axis')
  .attr('transform', `translate(0, ${usableArea.bottom})`)
  .call(d3.axisBottom(xScale));

const rScale = d3.scaleSqrt()
  .domain([0, d3.max(commits, (d) => d.totalLines)])
  .range([0, 30]);

let visibleCommits = commits;

const brush = d3.brush()
  .extent([
    [usableArea.left, usableArea.top],
    [usableArea.right, usableArea.bottom],
  ])
  .on('start brush end', brushed);

svg.append('g')
  .attr('class', 'brush')
  .call(brush);

function brushed(event) {
  const selection = event.selection;

  const selectedCommits = selection
    ? visibleCommits.filter((commit) => {
        const x = xScale(commit.datetime);
        const y = yScale(commit.hourFrac);

        return (
          x >= selection[0][0] &&
          x <= selection[1][0] &&
          y >= selection[0][1] &&
          y <= selection[1][1]
        );
      })
    : [];

  const selectedIds = new Set(selectedCommits.map((d) => d.id));

  svg.selectAll('.dots circle')
    .classed('selected', (d) => selectedIds.has(d.id));

  document.querySelector('#selection-count').textContent =
    selectedCommits.length > 0
      ? `${selectedCommits.length} commits selected`
      : 'No commits selected';
updateLanguageBreakdown(selectedCommits);
}

const dots = svg.append('g').attr('class', 'dots');

function updateScatterPlot(nextCommits) {
  visibleCommits = nextCommits;

  svg.select('g.brush').call(brush.move, null);

  if (nextCommits.length > 0) {
    xScale.domain(
      d3.extent(nextCommits, d => d.datetime)
    ).nice();

    svg.select('.x-axis')
      .call(d3.axisBottom(xScale));
  }

  const sortedCommits = d3.sort(
    nextCommits,
    d => -d.totalLines
  );

  dots.selectAll('circle')
    .data(sortedCommits, d => d.id)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill-opacity', 0.7)
    .attr('fill', 'steelblue')
    .on('mouseenter', (event, commit) => {
      updateTooltipContent(commit);
      document.querySelector('#commit-tooltip').hidden = false;
      updateTooltipPosition(event);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', () => {
      document.querySelector('#commit-tooltip').hidden = true;
    });
}

updateScatterPlot(commits);

return updateScatterPlot;
}
let data = await loadData();
let commits = processCommits(data)
  .sort((a, b) => a.datetime - b.datetime);

renderCommitInfo(data, commits);
const updateScatterPlot = renderScatterPlot(data, commits);
let commitProgress = 100;

let timeScale = d3.scaleTime()
  .domain(d3.extent(commits, d => d.datetime))
  .range([0, 100]);

let commitMaxTime = timeScale.invert(commitProgress);

let filteredCommits = commits;

const colors = d3.scaleOrdinal(d3.schemeTableau10)
  .domain([...new Set(data.map(d => d.type))]);

function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap(d => d.lines);

  const files = d3.groups(lines, d => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3.select('#files')
    .selectAll(':scope > div')
    .data(files, d => d.name)
    .join(enter =>
      enter.append('div').call(div => {
        div.append('dt').call(dt => {
          dt.append('code');
          dt.append('small');
        });

        div.append('dd');
      })
    )
    .order();

  filesContainer.select('code')
    .text(d => d.name);

  filesContainer.select('small')
    .text(d => `${d.lines.length} lines`);

  filesContainer.select('dd')
    .selectAll('.loc')
    .data(d => d.lines)
    .join('div')
    .attr('class', 'loc')
    .style('--color', d => colors(d.type));
}

function onTimeSliderChange() {
  commitProgress = Number(
    document.querySelector('#commit-progress').value
  );

  commitMaxTime = timeScale.invert(commitProgress);

  document.querySelector('#slider-time').textContent =
    commitMaxTime.toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

  filteredCommits = commits.filter(
    d => d.datetime <= commitMaxTime
  );
  updateScatterPlot(filteredCommits);
  updateFileDisplay(filteredCommits);
}

document.querySelector('#commit-progress')
  .addEventListener('input', onTimeSliderChange);

onTimeSliderChange();

d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html((d, i) => `
    <h3>Commit ${i + 1}</h3>

    <p>
      On ${d.datetime.toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short'
      })}, I updated my portfolio.
    </p>

    <p>
      I worked on ${d.totalLines} lines across
      ${d3.group(d.lines, line => line.file).size} files.
    </p>

    <p>
      <a href="https://github.com/maw044-source/portfolio-/commit/${d.id}"
         target="_blank">
        View this commit
      </a>
    </p>
  `);

  function onStepEnter(response) {
  const commit = response.element.__data__;

  commitProgress = timeScale(commit.datetime);

  document.querySelector('#commit-progress').value =
    commitProgress;

  onTimeSliderChange();

  // Use the exact commit date rather than a rounded slider value.
  commitMaxTime = commit.datetime;

  filteredCommits = commits.filter(
    d => d.datetime <= commitMaxTime
  );

  updateScatterPlot(filteredCommits);
  updateFileDisplay(filteredCommits);

  document.querySelector('#slider-time').textContent =
    commitMaxTime.toLocaleString();
}

const scroller = scrollama();

scroller
  .setup({
    container: '#scrolly-1',
    step: '#scatter-story .step',
    offset: 0.5,
  })
  .onStepEnter(onStepEnter);

window.addEventListener('resize', scroller.resize);