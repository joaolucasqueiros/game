"""Original seamless material maps for the 3D edition. Python + NumPy + Pillow."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'public/assets3d/textures'
OUT.mkdir(parents=True, exist_ok=True)
N = 512
rng = np.random.default_rng(4207)
y, x = np.mgrid[0:N, 0:N] / N

def noise(grid):
    a = rng.random((grid, grid))
    ux, uy = x * grid, y * grid
    ix, iy = ux.astype(int), uy.astype(int)
    fx, fy = ux % 1, uy % 1
    fx, fy = fx*fx*(3-2*fx), fy*fy*(3-2*fy)
    return ((1-fx)*(1-fy)*a[iy%grid,ix%grid] + fx*(1-fy)*a[iy%grid,(ix+1)%grid]
            + (1-fx)*fy*a[(iy+1)%grid,ix%grid] + fx*fy*a[(iy+1)%grid,(ix+1)%grid])

fbm = sum(noise(g)*w for g,w in [(4,.32),(8,.24),(16,.18),(32,.12),(64,.08),(128,.06)])
fine = rng.random((N,N))

def material(name, base, field, contrast=.65, strength=3):
    field = np.clip(field,0,1)
    c = np.array(base)[None,None,:] * (1 + (field[...,None]-.5)*contrast)
    c += (fine[...,None]-.5)*12
    Image.fromarray(np.uint8(np.clip(c,0,255))).save(OUT/f'{name}.png')
    dx = (np.roll(field,-1,axis=1)-np.roll(field,1,axis=1))*strength
    dy = (np.roll(field,-1,axis=0)-np.roll(field,1,axis=0))*strength
    normal = np.dstack((-dx,-dy,np.ones_like(dx)))
    normal /= np.linalg.norm(normal,axis=2)[...,None]
    Image.fromarray(np.uint8((normal*.5+.5)*255)).save(OUT/f'{name}_normal.png')
    Image.fromarray(np.uint8(np.clip(.72+field*.22,0,1)*255)).save(OUT/f'{name}_rough.png')

blades = (np.sin(x*2*np.pi*127 + np.sin(y*2*np.pi*8)*2)*np.sin(y*2*np.pi*73)> .74)*.15
material('grass',(85,105,48), fbm*.9+blades+(fine-.5)*.16, .95, 3)
material('forest',(48,69,32), fbm+(fine-.5)*.18, .9, 4)
material('earth',(137,110,75),fbm+(fine-.5)*.25,.9,4)
material('sand',(180,166,121),fbm*.65+fine*.35,.4,2)
material('rock',(110,112,107),fbm*.8+noise(32)*.2,.9,5)
material('mud',(73,74,53),fbm,.8,3)
grain = .5 + np.sin(x*2*np.pi*35 + noise(8)*9)*.13 + (fbm-.5)*.38
seams = ((x*6)%1 < .018) | ((y*2)%1 < .01)
material('wood',(115,77,43),np.where(seams,.06,grain),1.3,5)
material('bark',(88,74,49),.45+np.sin(x*2*np.pi*28+np.sin(y*2*np.pi*4)*2)*.22+(fbm-.5)*.5,1.2,6)
row=(y*7).astype(int); bx=(x*5+(row%2)*.5)%1; by=(y*7)%1
stone = .5+(fbm-.5)*.5
material('cobble',(130,127,113),np.where((bx<.045)|(by<.07),.04,stone+np.sin(bx*np.pi)*.13),.8,5)
row=(y*9).astype(int); bx=(x*7+(row%2)*.5)%1; by=(y*9)%1
material('roof',(117,65,40),np.where((bx<.035)|(by<.05),.04,.3+by*.38+(fbm-.5)*.3),.9,5)
material('plaster',(186,173,142),fbm*.75+fine*.25,.42,3)
material('leather',(95,62,39),fbm*.6+fine*.4,.6,3)
material('cloth',(49,85,75),.5+(fbm-.5)*.2+np.sin(x*2*np.pi*128)*.05+np.sin(y*2*np.pi*128)*.05,.6,2)
material('water',(72,116,116),.5+np.sin(x*2*np.pi*7+np.sin(y*2*np.pi*4))* .2 + (noise(16)-.5)*.2,.2,2)

im=Image.new('RGBA',(128,128));d=ImageDraw.Draw(im)
for i in range(180):
    px=int(rng.integers(8,120)); py=int(rng.integers(10,124)); h=int(rng.integers(15,50))
    d.polygon([(px,py),(px-2,py-h//2),(px+int(rng.integers(-12,13)),py-h),(px+2,py)],fill=(65+int(rng.integers(0,35)),94+int(rng.integers(0,40)),37,230))
im.save(OUT/'grass_card.png')
im=Image.new('RGBA',(128,128));d=ImageDraw.Draw(im)
for i in range(85):
    px=int(rng.integers(5,120));py=int(rng.integers(5,120));r=int(rng.integers(4,13))
    d.ellipse((px-r,py-r//2,px+r,py+r//2),fill=(58+int(rng.integers(0,45)),82+int(rng.integers(0,65)),32,255))
im.save(OUT/'leaves.png')

icons=OUT.parents[1]/'assets/items'
im=Image.new('RGBA',(32,32));d=ImageDraw.Draw(im)
d.line([(5,29),(18,5),(24,3)],fill='#583a24',width=3);d.line([(19,6),(25,26)],fill='#e8ddae');d.ellipse((22,24,28,30),fill='#c27d42',outline='#332a23');im.save(icons/'fishing_rod.png')
for name,c in [('raw_meat','#b6645c'),('cooked_meat','#986237')]:
    im=Image.new('RGBA',(32,32));d=ImageDraw.Draw(im);d.ellipse((4,7,28,25),fill=c,outline='#4e342b',width=2);d.ellipse((13,11,22,20),fill='#ecd9ae');d.arc((5,8,25,24),40,210,fill='#dfb893',width=2);im.save(icons/f'{name}.png')
print('Generated original PBR materials, normal/roughness maps, vegetation cards and icons.')
