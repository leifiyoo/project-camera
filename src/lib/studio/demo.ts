import { importMedia } from '../media/import';
import { listAssets, saveProject } from '../storage/db';
import { makeProject, makeScene, makeText } from './model';
import { composeScene } from './compose';

export async function createDemo(persist = true) {
  let assets: Awaited<ReturnType<typeof listAssets>> = [];
  try {
    assets = await listAssets();
  } catch (e) {
    if (persist) throw e;
  }
  const paths = [
    ['forma-desktop.png', 'Forma · Workspace'],
    ['soundspace-dark.png', 'Soundspace · Collection'],
    ['pace-mobile.png', 'Pace · Daily rhythm'],
  ];
  for (const [file, name] of paths)
    if (!assets.some((a) => a.name === name)) {
      const response = await fetch(`/demos/${file}`);
      if (!response.ok) throw new Error('Could not load the local demo.');
      const { record, saveError } = await importMedia(
        new File([await response.blob()], name, { type: 'image/png' }),
      );
      if (saveError && persist) throw saveError;
      assets = [...assets, record.meta];
    }
  const first = assets.find((a) => a.name === paths[0][1])!;
  const project = makeProject(first);
  project.name = 'A closer look';
  project.photo.pose.rx = 20;
  project.photo.pose.ry = -24;
  project.photo.pose.rz = -7;
  project.photo.background.color = '#e5e9ef';
  project.scenes = [
    composeScene({ ...makeScene(first), duration: 4 }, 'hero'),
    composeScene(
      {
        ...makeScene(assets.find((a) => a.name === paths[1][1])!),
        duration: 4,
        background: { ...project.photo.background, color: '#cbd3dd' },
      },
      'orbit',
    ),
  ];
  const title = makeScene(undefined, true);
  title.duration = 3;
  title.background.color = '#ffdc32';
  title.layers = [{ ...makeText('A closer look.\nA new perspective.'), size: 0.075, y: 0.34 }];
  project.scenes.push(title);
  if (persist) await saveProject(project);
  return project;
}
