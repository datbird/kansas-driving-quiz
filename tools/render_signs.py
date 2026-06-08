#!/usr/bin/env python3
"""Render standard (public-domain MUTCD) traffic signs as PNGs with Pillow.
Original artwork of the public-domain MUTCD sign designs; released CC0 (public domain).
Output: ../public/signs/*.png.  Requires: Pillow + a DejaVu Bold TTF (path below)."""
import os, math
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "signs")
os.makedirs(OUT, exist_ok=True)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SS = 4  # supersample

RED=(200,16,46); WHITE=(255,255,255); BLACK=(0,0,0); YELLOW=(252,209,22)
ORANGE=(245,130,32); GREEN=(0,122,51); SLOW=(245,130,32); SLOWBORDER=(200,16,46)
YG=(154,205,50)  # fluorescent yellow-green (school)

def canvas(w,h,bg=(0,0,0,0)):
    img=Image.new("RGBA",(w*SS,h*SS),bg); return img, ImageDraw.Draw(img)
def save(img,name):
    img=img.resize((img.width//SS, img.height//SS), Image.LANCZOS)
    img.save(os.path.join(OUT,name)); print("  ",name)
def font(sz): return ImageFont.truetype(FONT, sz*SS)
def ctext(d,cx,cy,txt,sz,fill,spacing=2):
    f=font(sz)
    lines=txt.split("\n");
    bb=[d.textbbox((0,0),ln,font=f) for ln in lines]
    hs=[b[3]-b[1] for b in bb]; total=sum(hs)+spacing*SS*(len(lines)-1)
    y=cy*SS-total/2
    for ln,b,h in zip(lines,bb,hs):
        w=b[2]-b[0]
        d.text((cx*SS-w/2-b[0], y-b[1]), ln, font=f, fill=fill)
        y+=h+spacing*SS
def poly_regular(cx,cy,r,n,rot=0):
    return [(cx+r*math.cos(rot+2*math.pi*i/n), cy+r*math.sin(rot+2*math.pi*i/n)) for i in range(n)]

S=2  # base scale of coordinates below (drawn in SS units already via *SS in helpers? no) -> we draw in px*SS manually
def U(v): return v*SS

# ---- STOP: red octagon ----
def stop():
    img,d=canvas(240,240)
    pts=poly_regular(120*SS,120*SS,118*SS,8,math.pi/8)
    d.polygon(pts,fill=RED,outline=WHITE);
    # white inner border
    pts2=poly_regular(120*SS,120*SS,100*SS,8,math.pi/8); d.line(pts2+[pts2[0]],fill=WHITE,width=5*SS)
    ctext(d,120,120,"STOP",56,WHITE)
    save(img,"stop.png")

# ---- YIELD: downward triangle ----
def yield_():
    img,d=canvas(240,220)
    m=14*SS
    pts=[(m,m),(240*SS-m,m),(120*SS,210*SS-m)]
    d.polygon(pts,fill=WHITE,outline=RED)
    d.line(pts+[pts[0]],fill=RED,width=14*SS)
    inner=[(45*SS,40*SS),(195*SS,40*SS),(120*SS,168*SS)]
    d.line(inner+[inner[0]],fill=RED,width=5*SS)
    ctext(d,120,82,"YIELD",30,RED)
    save(img,"yield.png")

# ---- DO NOT ENTER ----
def do_not_enter():
    img,d=canvas(240,240)
    d.rectangle([6*SS,6*SS,234*SS,234*SS],fill=WHITE,outline=BLACK,width=3*SS)
    d.ellipse([28*SS,28*SS,212*SS,212*SS],fill=RED)
    d.rectangle([60*SS,103*SS,180*SS,137*SS],fill=WHITE)
    save(img,"do-not-enter.png")

# ---- WRONG WAY ----
def wrong_way():
    img,d=canvas(300,180)
    d.rectangle([6*SS,6*SS,294*SS,174*SS],fill=RED,outline=WHITE,width=6*SS)
    ctext(d,150,90,"WRONG\nWAY",48,WHITE)
    save(img,"wrong-way.png")

# ---- ONE WAY ----
def one_way():
    img,d=canvas(300,120)
    d.rectangle([4*SS,4*SS,296*SS,116*SS],fill=BLACK)
    # arrow
    d.polygon([(40*SS,60*SS),(110*SS,40*SS),(110*SS,52*SS),(150*SS,52*SS),(150*SS,68*SS),(110*SS,68*SS),(110*SS,80*SS)],fill=WHITE)
    ctext(d,210,60,"ONE WAY",26,WHITE)
    save(img,"one-way.png")

# ---- NO PASSING ZONE (pennant) ----
def no_passing():
    img,d=canvas(300,150)
    pts=[(8*SS,8*SS),(292*SS,75*SS),(8*SS,142*SS)]
    d.polygon(pts,fill=YELLOW,outline=BLACK); d.line(pts+[pts[0]],fill=BLACK,width=4*SS)
    ctext(d,95,75,"NO\nPASSING\nZONE",20,BLACK)
    save(img,"no-passing.png")

# ---- SPEED LIMIT ----
def speed_limit():
    img,d=canvas(180,240)
    d.rectangle([6*SS,6*SS,174*SS,234*SS],fill=WHITE,outline=BLACK,width=5*SS)
    ctext(d,90,46,"SPEED",22,BLACK)
    ctext(d,90,80,"LIMIT",22,BLACK)
    ctext(d,90,160,"65",80,BLACK)
    save(img,"speed-limit.png")

# ---- RAILROAD crossbuck ----
def crossbuck():
    img,d=canvas(260,260)
    f=font(20)
    for ang in (45,-45):
        bar=Image.new("RGBA",(220*SS,46*SS),(0,0,0,0)); bd=ImageDraw.Draw(bar)
        bd.rounded_rectangle([0,0,220*SS-1,46*SS-1],radius=8*SS,fill=WHITE,outline=BLACK,width=3*SS)
        txt="RAILROAD" if ang==45 else "CROSSING"
        b=bd.textbbox((0,0),txt,font=f); bd.text((110*SS-(b[2]-b[0])/2,23*SS-(b[3]-b[1])/2-b[1]),txt,font=f,fill=BLACK)
        bar=bar.rotate(ang,expand=True,resample=Image.BICUBIC)
        img.alpha_composite(bar,(130*SS-bar.width//2,130*SS-bar.height//2))
    save(img,"crossbuck.png")

# ---- RAILROAD advance (round yellow) ----
def rr_advance():
    img,d=canvas(240,240)
    d.ellipse([8*SS,8*SS,232*SS,232*SS],fill=YELLOW,outline=BLACK,width=4*SS)
    # X
    d.line([(55*SS,55*SS),(185*SS,185*SS)],fill=BLACK,width=10*SS)
    d.line([(185*SS,55*SS),(55*SS,185*SS)],fill=BLACK,width=10*SS)
    ctext(d,70,120,"R",34,BLACK); ctext(d,170,120,"R",34,BLACK)
    save(img,"rr-advance.png")

# ---- SCHOOL (pentagon, yellow-green) ----
def school():
    img,d=canvas(240,240)
    pts=[(120*SS,10*SS),(228*SS,92*SS),(186*SS,228*SS),(54*SS,228*SS),(12*SS,92*SS)]
    d.polygon(pts,fill=YG,outline=BLACK); d.line(pts+[pts[0]],fill=BLACK,width=4*SS)
    ctext(d,120,140,"SCHOOL",24,BLACK)
    save(img,"school.png")

# ---- prohibition signs (circle + slash) ----
def _prohibit(name, draw_symbol):
    img,d=canvas(240,240)
    d.rectangle([6*SS,6*SS,234*SS,234*SS],fill=WHITE,outline=BLACK,width=3*SS)
    d.ellipse([30*SS,30*SS,210*SS,210*SS],outline=RED,width=16*SS)
    draw_symbol(d)
    d.line([(58*SS,58*SS),(182*SS,182*SS)],fill=RED,width=16*SS)  # slash
    save(img,name)

def no_left():
    def sym(d):
        d.line([(138*SS,168*SS),(138*SS,112*SS)],fill=BLACK,width=14*SS)   # shaft up
        d.line([(145*SS,112*SS),(96*SS,112*SS)],fill=BLACK,width=14*SS)    # bend left
        d.polygon([(98*SS,90*SS),(98*SS,134*SS),(66*SS,112*SS)],fill=BLACK) # arrowhead left
    _prohibit("no-left-turn.png",sym)
def no_right():
    def sym(d):
        d.line([(102*SS,168*SS),(102*SS,112*SS)],fill=BLACK,width=14*SS)   # shaft up
        d.line([(95*SS,112*SS),(144*SS,112*SS)],fill=BLACK,width=14*SS)    # bend right
        d.polygon([(142*SS,90*SS),(142*SS,134*SS),(174*SS,112*SS)],fill=BLACK) # arrowhead right
    _prohibit("no-right-turn.png",sym)
def no_uturn():
    def sym(d):
        d.arc([85*SS,80*SS,155*SS,150*SS],start=180,end=360,fill=BLACK,width=12*SS)
        d.line([(85*SS,115*SS),(85*SS,160*SS)],fill=BLACK,width=12*SS)
        d.line([(155*SS,115*SS),(155*SS,150*SS)],fill=BLACK,width=12*SS)
        d.polygon([(70*SS,160*SS),(100*SS,160*SS),(85*SS,185*SS)],fill=BLACK)
    _prohibit("no-u-turn.png",sym)

# ---- KEEP RIGHT ----
def keep_right():
    img,d=canvas(180,240)
    d.rectangle([6*SS,6*SS,174*SS,234*SS],fill=WHITE,outline=BLACK,width=5*SS)
    # diagonal shaft from upper-left to lower-right + arrowhead pointing down-right
    d.line([(62*SS,48*SS),(112*SS,168*SS)],fill=BLACK,width=16*SS)
    d.polygon([(86*SS,170*SS),(132*SS,182*SS),(108*SS,140*SS)],fill=BLACK)
    save(img,"keep-right.png")

# ---- SLOW MOVING VEHICLE triangle ----
def smv():
    img,d=canvas(240,220)
    out=[(120*SS,8*SS),(232*SS,200*SS),(8*SS,200*SS)]
    d.polygon(out,fill=SLOWBORDER)
    inn=[(120*SS,55*SS),(192*SS,180*SS),(48*SS,180*SS)]
    d.polygon(inn,fill=SLOW)
    save(img,"slow-moving.png")

# ---- WARNING (blank yellow diamond) ----
def warning():
    img,d=canvas(240,240)
    pts=[(120*SS,8*SS),(232*SS,120*SS),(120*SS,232*SS),(8*SS,120*SS)]
    d.polygon(pts,fill=YELLOW,outline=BLACK); d.line(pts+[pts[0]],fill=BLACK,width=5*SS)
    save(img,"warning.png")

# ---- CONSTRUCTION (blank orange diamond) ----
def construction():
    img,d=canvas(240,240)
    pts=[(120*SS,8*SS),(232*SS,120*SS),(120*SS,232*SS),(8*SS,120*SS)]
    d.polygon(pts,fill=ORANGE,outline=BLACK); d.line(pts+[pts[0]],fill=BLACK,width=5*SS)
    save(img,"construction.png")

# ---- MERGE (yellow diamond + merge arrow) ----
def merge():
    img,d=canvas(240,240)
    pts=[(120*SS,8*SS),(232*SS,120*SS),(120*SS,232*SS),(8*SS,120*SS)]
    d.polygon(pts,fill=YELLOW,outline=BLACK); d.line(pts+[pts[0]],fill=BLACK,width=5*SS)
    d.line([(120*SS,200*SS),(120*SS,90*SS)],fill=BLACK,width=12*SS)
    d.polygon([(105*SS,100*SS),(135*SS,100*SS),(120*SS,70*SS)],fill=BLACK)
    d.line([(80*SS,180*SS),(118*SS,130*SS)],fill=BLACK,width=12*SS)
    save(img,"merge.png")

print("rendering signs ->", OUT)
for fn in (stop,yield_,do_not_enter,wrong_way,one_way,no_passing,speed_limit,crossbuck,
           rr_advance,school,no_left,no_right,no_uturn,keep_right,smv,warning,construction,merge):
    fn()
print("done")
