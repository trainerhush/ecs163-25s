d3.csv("data/student_mental_health.csv").then(data => {
  // Preprocess: map depression yes to depressed
  // art major, remaining science
  const art = [
    "islamic education","pendidikan islam","laws","law", "human resources","psychology",
    "usuluddin","kenms","business administration","kirkhs","taasl",
    "fiqh fatwa","nursing","diploma tesl","diploma nursing","fiqh","benl","econs"
  ];

  data.forEach(d => {

    const rawDep = (d["Do you have Depression?"] || "").trim()
    d.depressed = rawDep === "Yes" ? "depressed" : "not depressed";
    const courseRaw = (d["What is your course?"] || "").trim().toLowerCase();
    d.group = art.includes(courseRaw) ? "arts" : "science";
    d.cgpa = (d["What is your CGPA?"] || "").trim();
  });

  //Pie Chart
  const pieCounts = d3.rollup(data, v => v.length, d => d.depressed);
  const pieData = Array.from(pieCounts, ([label, count]) => ({ label, count }));
  const pieArc = d3.arc().innerRadius(0).outerRadius(150);
  const pieLayout = d3.pie().value(d => d.count)(pieData);
  const pieColor = d3.scaleOrdinal(["depressed","not depressed"],["#fc0303","#2003fc"]);
  const gPie = d3.select("#pieChart").append("g").attr("transform","translate(225,200)");
  
  gPie.selectAll("path").data(pieLayout).enter().append("path")
    .attr("d", pieArc).attr("fill", d => pieColor(d.data.label));
  gPie.selectAll("text").data(pieLayout).enter().append("text")
    .attr("transform", d => `translate(${pieArc.centroid(d)})`)
    .attr("text-anchor","middle").text(d => `${d.data.label}: ${d.data.count}`);

  //Line Chart
  const rateMap = d3.rollup(
    data,
    v => d3.mean(v, d => d.depressed === "depressed" ? 1 : 0),
    d => d.cgpa
  );
  // probability of depress in each gpa
  const rateData = Array.from(rateMap, ([gpa, rate]) => ({ gpa, rate }));
  const svgLine = d3.select("#lineChart");
  const [w, h] = [450, 400]; 
  const m = { left: 60, top: 40, right: 20, bottom: 50 };
  const chartW = w - m.left - m.right, chartH = h - m.top - m.bottom;
  const x = d3.scalePoint().domain(rateData.map(d => d.gpa)).range([0, chartW]).padding(0.5);
  const y = d3.scaleLinear().domain([0,1]).range([chartH,0]);
  const gLine = svgLine.append("g").attr("transform", `translate(${m.left},${m.top})`);
  
  gLine.append("g").attr("transform", `translate(0,${chartH})`).call(d3.axisBottom(x));
  gLine.append("g").call(d3.axisLeft(y).tickFormat(d3.format(".0%")));
  gLine.append("text").attr("x",chartW/2).attr("y",chartH+40)
    .attr("text-anchor","middle").text("GPA Range");
  gLine.append("text").attr("transform","rotate(-90)")
    .attr("x", -chartH/2).attr("y", -40).attr("text-anchor","middle").text("Depression Rate");
  const lineGen = d3.line().x(d=>x(d.gpa)).y(d=>y(d.rate));
  gLine.append("path").datum(rateData)
    .attr("fill","none").attr("stroke","#03a5fc").attr("stroke-width",2)
    .attr("d", lineGen);
  gLine.selectAll("circle").data(rateData).enter().append("circle")
    .attr("cx",d=>x(d.gpa)).attr("cy",d=>y(d.rate)).attr("r",4).attr("fill","#2003fc");

  //Sankey Chart
  const sankNodes = [], sankLinks = [];
  const nodeIndex = new Map(); let idx = 0;
  
  function addNode(name) {
    if(!nodeIndex.has(name)) { nodeIndex.set(name,idx); sankNodes.push({ name }); idx++; }
    return nodeIndex.get(name);
  }
  const gpaGroups = d3.rollup(data, v => v.length, d => d.cgpa, d => d.group);
  
  gpaGroups.forEach((groupMap, gpa) => {
    groupMap.forEach((count, group) => {
      const depressedCount = data.filter(d => d.cgpa === gpa && d.group === group && d.depressed === "depressed").length;
      const notDepCount = count - depressedCount;
      const a = addNode(gpa), b = addNode(group);
      sankLinks.push({ source:a, target:b, value:count });
      const c1 = addNode("depressed"), c2 = addNode("not depressed");
      sankLinks.push({ source:b, target:c1, value:depressedCount });
      sankLinks.push({ source:b, target:c2, value:notDepCount });
    });
  });
  const sankData = { nodes: sankNodes, links: sankLinks };
  const sank = d3.sankey().nodeWidth(20).nodePadding(10).extent([[100,10],[950-10,500-10]]);
  sank(sankData);
  const svgSank = d3.select("#sankeyChart");
  svgSank.append("g").selectAll("rect").data(sankData.nodes).enter().append("rect")
    .attr("x",d=>d.x0).attr("y",d=>d.y0).attr("width",sank.nodeWidth()).attr("height",d=>d.y1-d.y0).attr("fill","#111");
  svgSank.append("g").selectAll("path").data(sankData.links).enter().append("path")
    .attr("d",d3.sankeyLinkHorizontal()).attr("stroke-width",d=>d.width).attr("stroke","#222").attr("fill","none").attr("opacity",0.6);
  svgSank.append("g").selectAll("text").data(sankData.nodes).enter().append("text")
    .attr("x",d=>d.x0<950/2?d.x1+6:d.x0-6).attr("y",d=> (d.y0+d.y1)/2).attr("text-anchor",d=>d.x0<950/2?'start':'end').text(d=>d.name);
});