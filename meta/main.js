import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

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

  // Draw the date axis.
  svg.append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale));

  // Draw the time-of-day axis.
  svg.append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(
      d3.axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00')
    );

const rScale = d3.scaleSqrt()
  .domain([0, d3.max(commits, (d) => d.totalLines)])
  .range([0, 30]);

const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

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
    ? commits.filter((commit) => {
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

    dots.selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill-opacity', 0.7)
    .attr('fill', 'steelblue')
    .on('mouseenter', (event, commit) => {
      updateTooltipContent(commit);
      document.querySelector('#commit-tooltip').hidden = false;
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', () => {
      document.querySelector('#commit-tooltip').hidden = true;
    });
}
let data = await loadData();
let commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);