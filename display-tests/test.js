const fs = require("fs");
const path = require("path");
const {spawn} = require('child_process')

function openInBrowser(filePath) {
  const fullPath = path.resolve(filePath);
  spawn("cmd", ["/c", "start", "", fullPath], { stdio: "ignore", detached: true });
}

// upload, delete, download
const folder = process.argv[2];

const folders = {
  CVM: "./results-cvm",
  VM: "./results-vm",
  Local: "./results-local"
};

const colors = {
  CVM: "red",
  VM: "blue",
  Local: "green"
};

async function generateChart() {
  const performanceData = {};
  const operationsSet = new Set();
  const sortedSizes = [];
  // Load data from all folders
  for (const [label, folderPath] of Object.entries(folders)) {
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".json")).filter(v => v.includes(`${folder}-perf`));
    performanceData[label] = {};

    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      const json = JSON.parse(content);

      const match = file.match(/-(\d+)mb-/);
      if (!match) continue;

      const sizeKey = match[1]; 
      performanceData[label][sizeKey] = json;

      Object.keys(json).forEach(op => {
        if (op !== "Operation") operationsSet.add(op);
      });

      if (!sortedSizes.includes(sizeKey)) {
        sortedSizes.push(sizeKey);
      }
    }
  }

  sortedSizes.sort((a, b) => parseInt(a) - parseInt(b));

  console.log(performanceData)

  // Generate one chart per operation
  for (const operation of operationsSet) {
    const datasets = Object.entries(performanceData).map(([label, fileMap]) => {
      const data = sortedSizes.map(size => {
        const json = fileMap[size];
        return json && operation in json ? json[operation] : null;
      });

      return {
        label,
        data,
        borderColor: colors[label],
        backgroundColor: colors[label],
        fill: false,
        tension: 0.1,
        pointBackgroundColor: "black"
      };
    });


    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${operation}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { background: white; color: black; font-family: sans-serif; padding: 2rem; }
    canvas { max-width: 1500px; height: 300px; max-height: 600px; transform: 'scale(1.5)'; }
  </style>
</head>
<body>
  <h2>${operation}</h2>
  <canvas id="chart"></canvas>
  <script>
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(sortedSizes)},
        datasets: ${JSON.stringify(datasets)}
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: ${JSON.stringify(operation)}
          },
          legend: {
            position: 'bottom'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Laikas, ms'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Failo dydis, mb'
            }
          }
        }
      }
    });
  </script>
</body>
</html>
`;

    const file = `./${folder}/chart_${operation.replace(/\s+/g, "_")}.html`;
    fs.writeFileSync(file, html);
    console.log(`Saved HTML chart: ${file}`);
    openInBrowser(path.resolve(file));
  }
}

generateChart();
