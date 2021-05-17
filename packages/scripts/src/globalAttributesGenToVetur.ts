let replaceInFiles =  require('../lib/replaceInFiles')
export async function filePathsToVeturJsonData(
  inputPaths: string[]
){
  return (await replaceInFiles({
    files:inputPaths,
    from:/directives*\(('|").+('|")(,|\))/g,
  })).matchs  as unknown as Array<string>
}
