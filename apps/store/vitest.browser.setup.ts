/**
 * The app's own stylesheet, in the browser the component tests run in.
 *
 * Not decoration. Base UI's radio is an empty `<span>` sized entirely by `size-4`, so without
 * Tailwind it has a zero bounding box and every `toBeVisible()` fails on a control that is
 * perfectly present. Loading the real stylesheet also means these tests judge visibility the way a
 * shopper's browser does, rather than the way an unstyled document does.
 */
import './src/styles.css'
