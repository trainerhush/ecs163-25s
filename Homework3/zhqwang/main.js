d3.csv("data/student_mental_health.csv").then(data => {
  // Do you have Depression? to  depressed/not depressed, divide major
  const artList = [
    "islamic education","pendidikan islam","laws","law",
    "human resources","psychology","usuluddin","kenms",
    "business administration","kirkhs","taasl","fiqh fatwa",
    "nursing","diploma tesl","diploma nursing","fiqh","benl","econs"
  ];
  data.forEach(d => {
    d.depressed = (d['Do you have Depression?']||'').trim().toLowerCase() === 'yes'
      ? 'depressed' : 'not depressed';
    const cr = (d['What is your course?']||'').trim().toLowerCase();
    d.majorType = artList.includes(cr) ? 'arts' : 'science';
    d.cgpa = (d['What is your CGPA?']||'').trim();
  });

  //Pie Chart
  const pw = 450, ph = 400;
  const pieCounts = d3.rollup(data, v=>v.length, d=>d.depressed);
  const pieData   = Array.from(pieCounts, ([label,count])=>({label,count}));
  const pieArc    = d3.arc().innerRadius(0).outerRadius(150);
  const pieLayout = d3.pie().value(d=>d.count)(pieData);
  const pieColor  = d3.scaleOrdinal()
    .domain(['depressed','not depressed'])
    .range(['#fc0303','#2003fc']);

  const gPie = d3.select('#pieChart')
    .append('g')              // g as container
    .attr('transform', `translate(${pw/2},${ph/2})`);


  gPie.append('text')
    .attr('y', -170)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('Overview');

  // add path for arc
  gPie.selectAll('path').data(pieLayout).enter().append('path')
    .attr('d', pieArc)
    .attr('fill', d => pieColor(d.data.label));

  gPie.selectAll('text.label').data(pieLayout).enter().append('text')
    .attr('class','label')
    .attr('transform', d => `translate(${pieArc.centroid(d)})`)
    .attr('text-anchor','middle')
    .style('font-size','12px')
    .text(d => `${d.data.label}: ${d.data.count}`);

  // Line Chart
  const svgLine = d3.select('#lineChart');   // svg container
  const [w,h] = [450,400];
  const margin = {l:60,t:60,r:20,b:50};
  const chartW = w - margin.l - margin.r;
  const chartH = h - margin.t - margin.b;
  const xScale = d3.scalePoint().padding(0.5).range([0,chartW]);
  const yScale = d3.scaleLinear().domain([0,1]).range([chartH,0]);


  const gLine = svgLine.append('g')
    .attr('transform', `translate(${margin.l},${margin.t})`);
  gLine.append('text') 
    .attr('x', chartW/2).attr('y', -20)
    .attr('text-anchor','middle').style('font-size','14px')
    .text('Drag to select, move select area to change, click blank to cancel');
  gLine.append('g')          // x at bottom
    .attr('transform', `translate(0,${chartH})`)
    .call(d3.axisBottom(xScale));
  gLine.append('g')          // y at left
    .call(d3.axisLeft(yScale).tickFormat(d3.format('.0%')));
  gLine.append('text')    
    .attr('x', chartW/2).attr('y', chartH+40)
    .attr('text-anchor','middle').text('GPA Range');
  gLine.append('text') 
    .attr('transform','rotate(-90)')
    .attr('x', -chartH/2).attr('y', -45)
    .attr('text-anchor','middle').text('Depression Rate');
  const linePath = gLine.append('path')
    .attr('fill','none').attr('stroke','#03a5fc').attr('stroke-width',2);

  const circleGroup = gLine.append('g');

  function drawLine(){
    // calculate depression rate for every gpa range
    const rateMap = d3.rollup(
      data,
      v=>d3.mean(v,d=>d.depressed==='depressed'?1:0),
      d=>d.cgpa
    );
    const rateData = Array.from(rateMap, ([gpa,rate])=>({gpa,rate}));
    xScale.domain(rateData.map(d=>d.gpa));
    gLine.select('g').call(d3.axisBottom(xScale));
    const lineGen = d3.line().x(d=>xScale(d.gpa)).y(d=>yScale(d.rate));
    linePath.datum(rateData).attr('d', lineGen);

    // draw data point
    const circles = circleGroup.selectAll('circle').data(rateData, d=>d.gpa);
    circles.enter().append('circle')
      .attr('cx',d=>xScale(d.gpa))
      .attr('cy',d=>yScale(d.rate))
      .attr('r',4)
      .attr('fill','#2003fc')
      .on('click', function() {
        d3.select(this).classed('blink', !d3.select(this).classed('blink'));
      });
    circles.exit().remove();
  }

  // create horizontal brush
  const brush = d3.brushX()
    .extent([[0,0],[chartW,chartH]])
    .on('end', ({selection}) => {
      if (!selection) {
        circleGroup.selectAll('circle')
          .classed('hidden', false)
          .classed('blink', false);
        svgLine.select('#info').remove();
        return;
      }
      const [x0,x1] = selection;
      const rateMap2 = d3.rollup(
        data,
        v=>d3.mean(v,d=>d.depressed==='depressed'?1:0),
        d=>d.cgpa
      );
      const rateData2 = Array.from(rateMap2, ([gpa,rate])=>({gpa,rate}));
      const sel = rateData2.filter(d=>xScale(d.gpa)>=x0 && xScale(d.gpa)<=x1);
 
      circleGroup.selectAll('circle')
        .classed('hidden', d=>!(xScale(d.gpa)>=x0 && xScale(d.gpa)<=x1))
        .classed('blink', d=>xScale(d.gpa)>=x0 && xScale(d.gpa)<=x1);
      svgLine.select('#info').remove();
      const range = sel.map(d=>d.gpa).join(', ');
      const avg = d3.format('.0%')(d3.mean(sel,d=>d.rate));
      // show select gpa range and rates
      svgLine.append('text')
        .attr('id','info')
        .attr('x', margin.l).attr('y', margin.t - 30)
        .text(`[${range}], Avg ${avg}`);
    });

  gLine.append('g').attr('class','brush').call(brush);
  drawLine();

  // Sankey Chart
  const svgSank = d3.select('#sankeyChart'); // SVG container
  const sw2 = 950, sh2 = 500;
  let nodes = [], links = [];
  const idxMap2 = new Map(); let id2 = 0;
  function addNode2(name){
    if (!idxMap2.has(name)){
      idxMap2.set(name, id2++);
      nodes.push({name});
    }
    return idxMap2.get(name);
  }
  computeAndLayout();
  function computeAndLayout(){
    nodes.length = 0; links.length = 0; idxMap2.clear(); id2 = 0;
    const grp = d3.rollup(
      data,
      v=>v.length,
      d=>d.cgpa,
      d=>d.majorType
    );
    // group aggregation
    grp.forEach((inner,gpa)=>{
      inner.forEach((cnt,mt)=>{
        const dep  = data.filter(d=>d.cgpa===gpa&&d.majorType===mt&&d.depressed==='depressed').length;
        const nd   = cnt - dep;
        const a = addNode2(gpa), b = addNode2(mt),
              c1 = addNode2('depressed'), c2 = addNode2('not depressed');
        links.push({source:a,target:b,value:cnt});
        links.push({source:b,target:c1,value:dep});
        links.push({source:b,target:c2,value:nd});
      });
    });
    const sank = d3.sankey().nodeWidth(20).nodePadding(10)
                   .extent([[100,10],[sw2-10,sh2-10]]);
    sank({nodes,links});
  }


  svgSank.append('text')
    .attr('x', sw2/2).attr('y', -10)
    .attr('text-anchor','middle').style('font-size','14px')
    .text('Click flows to toggle selection');


  const nodeG = svgSank.append('g'); 
  nodeG.selectAll('rect').data(nodes).enter().append('rect')
    .attr('x',d=>d.x0).attr('y',d=>d.y0) 
    .attr('width',20).attr('height',d=>d.y1-d.y0)
    .attr('fill','#888');              
  nodeG.selectAll('text').data(nodes).enter().append('text')
    .attr('x',d=>d.x0<sw2/2?d.x1+6:d.x0-6)
    .attr('y',d=> (d.y0+d.y1)/2)
    .attr('text-anchor',d=>d.x0<sw2/2?'start':'end')
    .text(d=>d.name);                    
  const linkG = svgSank.append('g'); 
  linkG.selectAll('path').data(links).enter().append('path')
    .attr('d',d3.sankeyLinkHorizontal()) // horizontal line
    .attr('stroke','#888').attr('fill','none').attr('opacity',0.6)
    .attr('stroke-width',d=>d.width)     // width as people
    .style('cursor','pointer')
    .on('click', function(event,d){
      // select and adjust line width
      const el = d3.select(this);
      const sel = !el.classed('selected');
      el.classed('selected',sel)
        .transition().duration(500)
        .attr('stroke-width', sel? d.width/2 : d.width);
      // sum line population
      const total = d3.sum(
        svgSank.selectAll('path.selected').data(),
        dd=>dd.value
      );
      const info = svgSank.selectAll('text#sankeyInfo').data([total]);
      info.join(
        enter => enter.append('text')
                      .attr('id','sankeyInfo')
                      .attr('x',sw2/2).attr('y',30)
                      .attr('text-anchor','middle')
                      .style('font-size','14px')
                      .text(d=>`Selected total: ${d}`),
        update => update.text(d=>`Selected total: ${d}`)
      );
    });

});
