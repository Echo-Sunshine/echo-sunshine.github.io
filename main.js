const map = L.map("map").setView([39.5, -98.35], 4);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.svg({ interactive: true }).addTo(map);

const svg = d3.select("#map").select("svg");
const g = svg.append("g").attr("class", "leaflet-zoom-hide");

const hexbin = d3.hexbin()
    .radius(12)
    .x(d => d.x)
    .y(d => d.y);

const colorScale = d3.scaleSequential()
    .interpolator(d3.interpolateRgb("white", "#8B4513"))
    .clamp(true);

let fullData = [];
let currentYear = null;
let selectedHex = null;

d3.csv("house cat occurences.imp.csv", d => ({
    lat: +d.Latitude,
    lon: +d.Longitude,
    year: +d.Year,
    imputed:
        +d.Latitude_imp === 1 ||
        +d.Longitude_imp === 1 ||
        +d.Year_imp === 1
}))
    .then(data => {

        fullData = data.filter(d =>
            !isNaN(d.lat) &&
            !isNaN(d.lon) &&
            !isNaN(d.year)
        );

        const years = fullData.map(d => d.year);
        const minYear = d3.min(years);
        const maxYear = d3.max(years);

        const slider = d3.select("#yearSlider")
            .attr("min", minYear)
            .attr("max", maxYear)
            .attr("value", minYear);

        currentYear = minYear;
        d3.select("#yearLabel").text(currentYear);

        drawHexes(fullData.filter(d => d.year === currentYear));

        slider.on("input", function () {
            currentYear = +this.value;
            d3.select("#yearLabel").text(currentYear);
            drawHexes(fullData.filter(d => d.year === currentYear));
        });

        map.on("zoomend moveend", () => {
            drawHexes(fullData.filter(d => d.year === currentYear));
        });
    });

function drawHexes(data) {

    selectedHex = null;

    g.selectAll(".hex").remove();

    const points = data.map(d => {
        const p = map.latLngToLayerPoint([d.lat, d.lon]);
        return {
            x: p.x,
            y: p.y,
            imputed: d.imputed
        };
    });

    const bins = hexbin(points);
    if (bins.length === 0) return;

    colorScale.domain([0, d3.max(bins, d => d.length) || 1])

    g.selectAll(".hex")
        .data(bins)
        .enter()
        .append("path")
        .attr("class", "hex leaflet-interactive")
        .attr("d", hexbin.hexagon())
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .attr("fill", d => colorScale(d.length))
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .attr("fill-opacity", d => d.some(p => p.imputed) ? 0.25 : 0.7)
        .style("transition", "fill-opacity 0.2s, stroke-width 0.2s")

        .on("mouseover", function () {
            d3.select(this)
                .attr("stroke-width", 1.5)
                .attr("fill-opacity", 0.7);
        })
        .on("mouseout", function (event, d) {
            if (this === selectedHex) return;
            d3.select(this)
                .attr("stroke-width", 0.5)
                .attr("fill-opacity", d.some(p => p.imputed) ? 0.25 : 0.7);
        })

        .on("click", function (event, d) {

            g.selectAll(".hex")
                .attr("stroke-width", 0.5)
                .attr("fill-opacity", h => h.some(p => p.imputed) ? 0.25 : 0.7);

            selectedHex = this;

            d3.select(this)
                .attr("stroke-width", 2.5)
                .attr("fill-opacity", 0.8);

            const total = d.length;
            const imputedCount = d.filter(p => p.imputed).length;

            d3.select("#hex-info").html(`
  <p><strong>Year:</strong> ${currentYear}</p>
  <p><strong>Observations in hex:</strong> ${total}</p>
  <p><strong>Imputed locations:</strong> ${imputedCount}</p>
  <p><strong>Data quality:</strong>
      ${imputedCount > 0
                ? "Some locations have high uncertainty"
                : "All locations reported directly"}
  </p>


            `);

        });
}
