#!/usr/bin/env python3
"""Sweep the existing behavioural OPA356/LMV7219 model; NOT measured calibration.
Runs a short cable as a lumped 7 pF / 0.5 ohm estimate, saves CSV and plots.
The simplified model omits noise, common-mode limits, propagation dispersion,
parasitic tolerances and a validated SiPM impulse response. No efficiency claim.
"""
import argparse, csv, json, os, pathlib, subprocess
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[2]

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--out',type=pathlib.Path,default=ROOT/'hw/out/modular/analog')
 p.add_argument('--cable-pf',type=float,default=7.0)
 args=p.parse_args(); args.out.mkdir(parents=True,exist_ok=True)
 if args.cable_pf<=0: p.error('cable capacitance must be positive')
 source=(ROOT/'hw/sim/scope_guide.cir').read_text().split('.control')[0]
 source=source.replace('T1 a_far 0 sigc 0 Z0=50 TD=10n',f'Rcable a_far sigc 0.5\nCcable1 a_far 0 {args.cable_pf/2}p\nCcable2 sigc 0 {args.cable_pf/2}p')
 points=[1,2,3,4,5,6,8,10,15,20,30,36,50,75,100,150,200]
 commands=['.control','set wr_singlescale','set wr_vecnames','alterparam INJON=0','alterparam TILE=1']
 for npe in points:
  commands += [f'alterparam NPE={npe}','reset','tran 0.2n 2u 0 0.5n','linearize v(tia) v(hit)',f'wrdata pe{npe}.txt v(tia) v(hit)']
 deck=args.out/'tot_sweep.cir';deck.write_text(source+'\n'+'\n'.join(commands)+'\n.endc\n.end\n')
 proc=subprocess.run(['ngspice','-b',deck.name],cwd=args.out,text=True,capture_output=True,timeout=180)
 (args.out/'ngspice.log').write_text(proc.stdout+proc.stderr)
 if proc.returncode: raise RuntimeError('ngspice failed; inspect ngspice.log')
 rows=[]
 for npe in points:
  data=np.loadtxt(args.out/f'pe{npe}.txt',skiprows=1)
  t,v,hit=data[:,0],data[:,1],data[:,2]
  # Exclude initial model settling; source impulse starts at 200 ns.
  baseline=float(np.median(v[(t>=150e-9)&(t<190e-9)]))
  mask=t>=190e-9; t,v,hit=t[mask],v[mask],hit[mask]
  high=hit>1.65
  edges=np.flatnonzero(np.diff(np.r_[False,high,False]))
  spans=[(a,b) for a,b in zip(edges[::2],edges[1::2])]
  if any(b==len(t) for a,b in spans): raise RuntimeError('Simulation window truncates a pulse')
  widths=[(t[b]-t[a])*1e9 for a,b in spans]
  rows.append({'npe':npe,'baseline_V':baseline,'peak_mV':float((baseline-v.min())*1000),'tot_ns':float(max(widths,default=0)),
               'pulses':len(spans),'source':'behavioural simulation, not measurement'})
 with (args.out/'tot.csv').open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
 report={'model':'OPA356 behavioural + LMV7219 behavioural','rf_ohm':33000,'cf_pf':2.7,
         'baseline_V':2.5,'threshold_V':2.465,'cable_pf':args.cable_pf,
         'time_step_ns':0.2,'clock_target_ns':10,'rows':rows,
         'limitations':'No noise, no validated common-mode/overload model; physical calibration required; not energy or muon momentum measurement.'}
 (args.out/'tot_report.json').write_text(json.dumps(report,indent=2))
 os.environ.setdefault('MPLCONFIGDIR',str(args.out/'mpl-cache'))
 import matplotlib
 matplotlib.use('Agg')
 import matplotlib.pyplot as plt
 fig,ax=plt.subplots(1,2,figsize=(10,4),layout='constrained')
 ax[0].plot(points,[r['peak_mV'] for r in rows],'o-');ax[0].set(ylabel='Pulse excursion (mV)',xlabel='Injected photoelectrons')
 ax[1].plot(points,[r['tot_ns'] for r in rows],'o-');ax[1].set(ylabel='Time over threshold (ns)',xlabel='Injected photoelectrons')
 for a in ax:a.grid(alpha=.2);a.set_xscale('log')
 fig.suptitle('OPA356 / LMV7219 · behavioural estimate, not calibrated data')
 fig.savefig(args.out/'tot.png',dpi=160)
 print(json.dumps({'output':str(args.out),'muon_36pe':next(r for r in rows if r['npe']==36)},indent=2))
if __name__=='__main__':main()
