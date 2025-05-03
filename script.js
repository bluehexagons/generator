var canvas;
var ctx;
var timer;
var x=0;var y=0;
var i=1;var p=0;
var max=10;
var h;var w;var s=5;var once=5;var repeat=false;
var seedMode=0;
var seedDir=0;
var seed=nextSeed();
var runonce=false;var buffer=false;var framebuffer=false;var bufferCan=true;var safety=true;
var pauseby=1000;

window.addEventListener('load', 
function(e) {
  begin();
}, false);
//window.addEventListener('click',go);
function go() {
clearInterval(timer);
timer=setInterval(change,0);
y=0;
p=0;
x=0;
if (!repeat) {
i++;
i%=max;
}
$("rendermode").value=i;
seed=nextSeed();
$("seed").value=seed;
}
function nextSeed() {
var nseed=seed;
switch (parseInt(seedMode)) {
case 0:return Math.random();break;
case 1:
	if (seedMode-Math.floor(seedMode) > 0) nseed=seed+seedMode-Math.floor(seedMode);
	else nseed=seed+0.1;
	if (nseed > 1) {nseed=0.9999999999999999;seedMode=2+seedMode-Math.floor(seedMode);$("seedmode").value=seedMode;}
	break;
case 2:
	if (seedMode-Math.floor(seedMode) > 0) nseed=seed-(seedMode-Math.floor(seedMode));
	else nseed=seed-0.1;
	if (nseed < 0) {nseed=0;seedMode=1+seedMode-Math.floor(seedMode);$("seedmode").value=seedMode;}
	break;
default:return seed;break;
}
return nseed;
}
function begin() {
canvas=$("can");
h=canvas.offsetHeight;
w=canvas.offsetWidth;
if (once==0) once=w/s+1;
ctx = canvas.getContext("2d");
timer=setInterval(change,0);
$("rendermode").value=i;
$("pixelsize").value=s;
$("atonce").value=once;
$("seed").value=seed;
$("seedmode").value=seedMode;
$("delay").value=pauseby;
$("cycle").checked=!runonce;
$("repeat").checked=repeat;
$("buffer").checked=buffer;
$("safety").checked=safety;
}
function reboot() {
//clearTimeout(timer);
//clearInterval(timer);
h=canvas.offsetHeight;
w=canvas.offsetWidth;
if (once==0) once=w/s+1;
y=0;
p=0;
x=0;
}
function afterpause() {
//$("resize").value=Math.random();
clearTimeout(timer);
timer=setInterval(change,0);
}
function canvasSwap() {
	canvas.style.display="";
	if (bufferCan) {
		canvas=$("can2");
	}else {
		canvas=$("can");
	}
	ctx = canvas.getContext("2d");
	canvas.style.display="none";
	bufferCan=!bufferCan;
}
function change() {
if (safety) {
var time=new Date();
var last=time.getMilliseconds()+time.getSeconds()*1000+time.getMinutes()*60000;
}
for (var onc=0;onc<once;onc++){
if (safety) {
var time=new Date();
var cur=(time.getMilliseconds()+time.getSeconds()*1000+time.getMinutes()*60000)-last;

if (cur > 100) {
once=onc;
$("atonce").value=once;
}
}
ctx.fillStyle = pixel();
ctx.fillRect(x, y, s, s);
x+=s;
p+=s*s;

if (x>w) {
x=0;
y+=s;
}
if (y>h) {
if (buffer) canvasSwap();
if (!runonce) {
y=0;
if (!repeat) {
i++;
i%=max;
$("rendermode").value=i;
}
p=0;
seed=nextSeed();
$("seed").value=seed;
clearInterval(timer);
timer=setTimeout(afterpause,pauseby);
break;
}
if (runonce) {clearInterval(timer);clearTimeout(timer);break;}
}

}
}
function pixel() {
return eval("pixel"+i+"()");
/*switch(i) {
case 0:return pixel0();break;
case 1:return pixel1();break;
case 2:return pixel2();break;
case 3:return pixel3();break;
case 4:return pixel4();break;
case 5:return pixel5();break;
case 6:return pixel6();break;
case 7:return pixel7();break;
case 8:return pixel8();break;
}*/
}
function pixel0() {
var pixcol=(Math.random()*256*256*256*(1-x/w)+seed*256*256*256*(x/w));
//pixcol=(x/w)*pixcol;
return "rgb("+
Math.floor(pixcol%256)+","+
Math.floor(pixcol/256%256)+","+
Math.floor(pixcol/256/256)+")";
}
function pixel1() {
var tx=seed*65536+x;
var ty=seed*65536+y;
return "rgb("+
Math.floor(tx%256)+","+
Math.floor(ty%256)+","+
Math.floor((tx+ty)%256)+")";
}
function pixel2() {
var tp=seed*65536+p;
return "rgb("+
Math.floor(tp%256)+","+
Math.floor((tp/128)%256)+","+
Math.floor((tp/256)%256)+")";
}
function pixel3() {
var tp=seed*256*256;
var pix=((y/h*256)+(x/w*256))%256;
return "rgb("+
Math.floor((pix+tp/256/256)%256)+","+
Math.floor((pix+tp/256)%256)+","+
Math.floor((pix+tp)%256)+")";
}
function pixel4() {
var scale=Math.pow(Math.pow(x-w,2)+Math.pow(y-h,2),1/2)/Math.pow(Math.pow(w,2)+Math.pow(h,2),1/2);
var pixcol=(seed*256*256*256*scale);
return "rgb("+
Math.floor(pixcol%256)+","+
Math.floor(pixcol/256%256)+","+
Math.floor(pixcol/256/256)+")";
}
function pixel5() {
var scale=Math.pow(Math.pow(x-w,2)+Math.pow(y-h,2),1/2)/Math.pow(Math.pow(w,2)+Math.pow(h,2),1/2);
var pixcol=(seed*256*256*256);
return "rgb("+
Math.floor(pixcol%256*scale)+","+
Math.floor(pixcol/256%256*scale)+","+
Math.floor(pixcol/256/256*scale)+")";
}
function pixel6() {
var r=x/w*256;
var g=(x/w+y/h)/2*256;
var b=y/h*256;
var pixcol=(r+g*256+b*256*256)*seed;
//return "rgb("+
//Math.floor(r)+","+
//Math.floor(g)+","+
//Math.floor(b)+")";
return "rgb("+
Math.floor(pixcol%256)+","+
Math.floor(pixcol/256%256)+","+
Math.floor(pixcol/256/256)+")";
}
function pixel7() {
var scale=Math.pow(Math.pow(x-w,2)+Math.pow(y-h,2),1/2)/Math.pow(Math.pow(w,2)+Math.pow(h,2),1/2);
var pixcol=(seed/2*256*256*256*scale*2)*((x/w)*(y/h))/256;

return "rgb("+
Math.floor(pixcol%256)+","+
Math.floor(pixcol/256%256)+","+
Math.floor(pixcol/256/256)+")";
}
function pixel8() {
var pixcol=(seed*256*256*256);
//pixcol+=((Math.random()-0.5)*(y/h)*(pixcol/2))/100;
var r=pixcol%256;
var g=pixcol/256%256;
var b=pixcol/256/256;

r=(r*(1-y/h)+Math.random()*256*(y/h));
g=(g*(1-y/h)+Math.random()*256*(y/h));
b=(b*(1-y/h)+Math.random()*256*(y/h));

//r+=((Math.random()-0.5)*(y/h)*(r/2))
//g+=((Math.random()-0.5)*(y/h)*(g/2))
//b+=((Math.random()-0.5)*(y/h)*(b/2))
return "rgb("+
Math.floor(r)+","+
Math.floor(g)+","+
Math.floor(b)+")";
}
function pixel9() {
var tseed=seed/2+0.5;
var r=((p+x+y)/3)/((w*h+w+h)/3)*256;
var g=tseed*(x/w)*256;
var b=tseed*256;
r+=r/2*(tseed*2-1);
return "rgb("+Math.floor(r)+","+Math.floor(g)+","+Math.floor(b)+")";
}


function $(id){return document.getElementById(id);}