const fs = require("fs");
const path = require("path");
const {spawn} = require('child_process')

function openInBrowser(filePath) {
  const fullPath = path.resolve(filePath);
  spawn("cmd", ["/c", "start", "", fullPath], { stdio: "ignore", detached: true });
}

// upload, delete, download
const folder = process.argv[2];
const apiResponse = process.argv[3] === 'true'

const folders = apiResponse ? {
  CVM: "./results-cvm/api-response",
  VM: "./results-vm/api-response",
  LM: "./results-local/api-response"
} : {
  CVM: "./results-cvm",
  VM: "./results-vm",
  LM: "./results-local"
}

const colors = {
  CVM: "red",
  VM: "blue",
  LM: "green"
};

async function generateChart() {
  const performanceData = {};
  // const apiResponsePerfData = {};
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
        if (op !== "Operacija") operationsSet.add(op);
      });

      if (!sortedSizes.includes(sizeKey)) {
        sortedSizes.push(sizeKey);
      }
    }
  }

  sortedSizes.sort((a, b) => parseInt(a) - parseInt(b));

  // Generate one chart per operation
  for (const operation of operationsSet) {
    let datasets = Object.entries(performanceData).map(([label, fileMap]) => {
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

   datasets = datasets.filter(v => v.data.filter(Boolean).length > 0)

    const html = `
<!DOCTYPE html >
<html>
<head>
 <meta charset="utf-8">
 <title>${operation === "Rezultato užšifravimas" ? "Failo užšifravimas" : operation}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { background: white; color: black; font-family: sans-serif; padding: 2rem; }
    canvas { max-width: 1500px; height: 300px; max-height: 600px; transform: 'scale(1.5)'; }
  </style>
</head>
<body>
  <h2>${operation === "Rezultato užšifravimas" ? "Failo užšifravimas" : operation}</h2>
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
            text: ${JSON.stringify(operation === "Rezultato užšifravimas" ? "Failo užšifravimas" : operation)}
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
