// Built-in, hand-written guides (NOT extracted from the web). Standard origami; labelled "built-in" in the UI.
// fold: {hinge:[x1,z1,x2,z2], flap:[[x,z],...]} in paper coords; the flap polygon rotates 180deg about the hinge.
window.PRESETS = [
 {id:"airplane", emoji:"✈️", title:"Paper airplane (classic dart)", paper:{w:1.0,h:1.4,color:"#ffd86b"},
  materials:["1 sheet of letter/A4 paper"], warnings:["Don't throw it toward anyone's face or at pets.","Sharpen creases with a fingernail, not scissors."],
  steps:[
   {title:"Fold in half lengthwise", detail:"Fold the paper in half the long way, crease firmly, then unfold. This center crease is your guide for everything else."},
   {title:"Fold the top corners to the center", detail:"Fold both top corners in so the top edge lines up with the center crease. You now have a pointed nose."},
   {title:"Fold the angled edges to the center again", detail:"Fold each slanted edge in to meet the center crease. The nose gets narrower and sharper."},
   {title:"Fold the plane in half", detail:"Fold the whole thing in half along the center crease with the folded flaps on the outside."},
   {title:"Fold the wings down", detail:"Fold each wing down so its top edge lines up with the bottom edge of the body. Make both wings match."},
   {title:"Open the wings and fly it", detail:"Open the wings flat, bend the tips up slightly, and throw it gently forward."}]},
 {id:"boat", emoji:"⛵", title:"Paper boat (classic hat-boat)", paper:{w:1.0,h:1.4,color:"#9ad1ff"},
  materials:["1 sheet of letter/A4 paper"], warnings:["Use ordinary paper; it will get soggy in water."],
  steps:[
   {title:"Fold in half", detail:"Fold the sheet in half, short edges together, so the fold is at the top."},
   {title:"Fold the top corners to the middle", detail:"With the fold at the top, fold both top corners down to meet in the center. A strip of paper stays at the bottom."},
   {title:"Fold the bottom strips up", detail:"Fold the strip at the bottom up over the triangles. Flip and do the same on the back."},
   {title:"Open into a diamond", detail:"Pull the middle open and flatten it into a diamond shape."},
   {title:"Fold the bottom point up", detail:"Fold the bottom corner of the front layer up to the top point. Flip and repeat on the back to get a small triangle."},
   {title:"Open into a diamond again", detail:"Open the middle again and flatten into a diamond."},
   {title:"Pull apart", detail:"Hold the two top points and gently pull them apart, then flatten the bottom. Your boat is done."}]},
 {id:"crane", emoji:"🕊️", title:"Origami crane (traditional)", paper:{w:1.2,h:1.2,color:"#ff9eb5"},
  materials:["1 square sheet (15 cm / 6 in works well)"], warnings:["Needs a perfectly square sheet. Cut letter paper to a square first, with an adult if you use scissors.","Steps 6-7 (the petal fold) are the hardest. Go slow."],
  steps:[
   {title:"Fold both diagonals", detail:"Colored side up, fold the square in half diagonally, unfold, then fold the other diagonal and unfold."},
   {title:"Fold in half both ways", detail:"Flip the paper over. Fold it in half horizontally, unfold, then vertically, unfold."},
   {title:"Collapse into the square base", detail:"Bring the three corners down to the bottom corner so the paper collapses into a smaller square. Crease all edges."},
   {title:"Make the kite", detail:"With the open end at the bottom, fold the left and right edges of the top layer in to the center crease."},
   {title:"Fold the top down and unfold", detail:"Fold the top triangle down over the kite flaps, crease sharply, then unfold everything back."},
   {title:"Petal fold", detail:"Lift the bottom corner of the top layer up and past the top crease. Push the sides inward so they fold along the existing creases and flatten."},
   {title:"Repeat on the back", detail:"Flip the model over and repeat steps 4 to 6 on the other side."},
   {title:"Narrow the legs", detail:"Fold the left and right lower flaps in to the center line. Flip and repeat."},
   {title:"Make the neck and tail", detail:"Fold the two narrow points upward with an inside reverse fold: one for the neck, one for the tail."},
   {title:"Shape the head and wings", detail:"Inside-reverse-fold the tip of the neck for a head. Pull the wings apart and gently flatten the body."}]},
 {id:"cup", emoji:"🥤", title:"Paper cup", paper:{w:1.2,h:1.2,color:"#c4f0a8"},
  materials:["1 square sheet"], warnings:["Not waterproof. Use for dry snacks or as a decoration."],
  steps:[
   {title:"Fold in half diagonally", detail:"Fold the square corner to corner into a triangle with the long edge at the bottom."},
   {title:"Fold the right corner over", detail:"Fold the right corner across so its tip touches the left edge, about one third from the top."},
   {title:"Fold the left corner over", detail:"Fold the left corner across the same way so the tip touches the right edge."},
   {title:"Tuck the front flap", detail:"Fold the front point of the top flap down into the pocket. Flip and do the same on the back."},
   {title:"Open the cup", detail:"Pull the opening apart and press the bottom flat."}]}
,
 {id:"laces", emoji:"👟", title:"Tie your shoelaces", paper:null,
  materials:["A shoe with laces"], warnings:["Tuck loose laces in so you don't trip."],
  steps:[
   {title:"Cross and tighten", detail:"Cross the two laces over each other, pull one under the other, and tighten to make a starting knot."},
   {title:"Make a loop", detail:"Make a loop (a 'bunny ear') with one lace and pinch it at the base."},
   {title:"Wrap the other lace", detail:"Wrap the other lace around the loop, going around the front and then back toward you."},
   {title:"Push through", detail:"Push the wrapping lace through the gap that forms at the back, creating a second loop."},
   {title:"Pull both loops", detail:"Pull both loops outward evenly to tighten the bow."}]},
 {id:"coffee", emoji:"☕", title:"Pour-over coffee", paper:null,
  materials:["Coffee, filter, dripper, mug, kettle, scale (optional)"], warnings:["Hot water: pour slowly and keep the kettle away from the edge of the counter.","Hot water burns skin. Ask an adult if you're under 13."],
  steps:[
   {title:"Heat the water", detail:"Heat water until it just stops boiling (about 93 C / 200 F)."},
   {title:"Set up the filter", detail:"Place the filter in the dripper over your mug and rinse it with a little hot water. Pour that rinse water out."},
   {title:"Add the coffee", detail:"Add about 15 g (2 tablespoons) of medium-ground coffee to the filter and level it."},
   {title:"Bloom", detail:"Pour just enough water to wet the grounds and wait 30 seconds."},
   {title:"Pour slowly", detail:"Pour about 250 ml of water in slow circles, finishing in 2 to 3 minutes."},
   {title:"Remove and enjoy", detail:"Lift out the dripper carefully, since it's hot, and let the coffee cool a bit before drinking."}]}
];
// Idealized flat-fold geometry (own simulation, see fold.js). Coordinates: paper centered at 0, x right, z down on screen.
// Steps without ops are text-only: the 3D view stops simulating there and says so.
(function(){const O={
 airplane:[
  [{kind:"fold",p:[0,-.7],q:[0,.7],flapPt:[.25,0],crease:true}],
  [{kind:"fold",p:[0,-.7],q:[-.5,-.2],flapPt:[-.4,-.6]},{kind:"fold",p:[0,-.7],q:[.5,-.2],flapPt:[.4,-.6]}],
  [{kind:"fold",p:[0,-.7],q:[-.383,.224],flapPt:[-.45,-.1]},{kind:"fold",p:[0,-.7],q:[.383,.224],flapPt:[.45,-.1]}],
  [{kind:"fold",p:[0,-.7],q:[0,.7],flapPt:[.25,0],dir:"under"}]],
 boat:[
  [{kind:"fold",p:[-.5,0],q:[.5,0],flapPt:[0,-.35]}],
  [{kind:"foldTo",from:[-.5,0],to:[0,.5]},{kind:"foldTo",from:[.5,0],to:[0,.5]}],
  [{kind:"fold",p:[-.5,.5],q:[.5,.5],flapPt:[0,.65]}]],
 crane:[
  [{kind:"fold",p:[-.6,.6],q:[.6,-.6],flapPt:[.3,.3],crease:true},{kind:"fold",p:[-.6,-.6],q:[.6,.6],flapPt:[-.3,.3],crease:true}],
  [{kind:"flip"},{kind:"fold",p:[-.6,0],q:[.6,0],flapPt:[0,.3],crease:true},{kind:"fold",p:[0,-.6],q:[0,.6],flapPt:[.3,0],crease:true}]],
 cup:[
  [{kind:"fold",p:[-.6,.6],q:[.6,-.6],flapPt:[-.3,-.3]}],
  [{kind:"rotate",deg:-135},{kind:"foldTo",from:[.85,0],to:[-.283,-.567]}],
  [{kind:"foldTo",from:[-.85,0],to:[.283,-.567]}]]
};
PRESETS.forEach(p=>{if(O[p.id])O[p.id].forEach((ops,i)=>{if(p.steps[i])p.steps[i].ops=ops})})})();
